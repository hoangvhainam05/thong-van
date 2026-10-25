"use client";

// Kho dữ liệu phía trình duyệt cho bản demo giao diện.
// Mọi thao tác đi qua các hàm "action" bên dưới; mỗi action kiểm tra quyền trước khi
// đổi dữ liệu, giống cách backend sẽ làm. Khi nối API thật, chỉ cần thay thân các action.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { buildSeed } from "./mock/seed";
import { can, LOCKED, ROLES } from "./rbac";
import { addDays, hm, toMin, ymd } from "./format";
import { etaWindow, optimize } from "./optimizer";
import { api, loadToken } from "./api";

const KEY = "thongvan_demo_v3";
const StoreCtx = createContext(null);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.version === 3 && s.seedDate === ymd()) return s;
      // dữ liệu của ngày khác: sinh lại để ngày tháng khớp hôm nay, giữ phiên đăng nhập
      const fresh = buildSeed();
      fresh.session = s.session || null;
      return fresh;
    }
  } catch {}
  return buildSeed();
}

function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

function mapServerOrder(row, localId, customerId = 0) {
  const createdAt = row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString();
  return {
    id: localId,
    serverId: row.id,
    source: row.source || "WEB",
    inventoryReserved: Boolean(row.inventory_reserved),
    code: row.code,
    customerId,
    customerName: row.customer_name,
    phone: row.phone,
    recipientName: row.recipient_name || row.customer_name,
    recipientPhone: row.recipient_phone || row.phone,
    isGift: Boolean(row.is_gift),
    address: row.address,
    district: "",
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    items: (row.items || []).map((item) => ({
      productId: item.product_id,
      name: item.product_name,
      price: Number(item.unit_price),
      qty: item.quantity,
    })),
    subtotal: Number(row.subtotal),
    shippingFee: Number(row.shipping_fee),
    total: Number(row.total),
    deliveryDate: row.delivery_date,
    window: {
      start: String(row.time_window_start || "08:00").slice(0, 5),
      end: String(row.time_window_end || "17:00").slice(0, 5),
    },
    payment: {
      method: row.payment_method === "BANK_TRANSFER" ? "BANK" : row.payment_method === "COUNTER_CASH" ? "COUNTER_CASH" : "COD",
      status: row.payment_status || "UNPAID",
    },
    paymentInstructions: row.payment_instructions || null,
    requestedInfo: (row.history || [])
      .filter((event) => event.event_type === "INFO_REQUEST")
      .map((event) => ({ message: event.note, at: event.at })),
    note: row.note || "",
    status: row.status,
    createdAt,
    history: (row.history || []).map((event) => ({
      status: event.status || row.status,
      at: event.at ? new Date(event.at).toISOString() : createdAt,
      by: event.by || "Hệ thống",
      note: event.note || "",
    })),
  };
}

export const ORDER_STATUS = {
  PENDING: { label: "Chờ xác nhận", tone: "neutral" },
  CONFIRMED: { label: "Đã xác nhận", tone: "info" },
  READY: { label: "Sẵn sàng giao", tone: "info" },
  SCHEDULED: { label: "Đã xếp lịch", tone: "plan" },
  OUT_FOR_DELIVERY: { label: "Đang giao", tone: "move" },
  DELIVERED: { label: "Đã giao", tone: "ok" },
  FAILED: { label: "Giao thất bại", tone: "bad" },
  CANCELLED: { label: "Đã huỷ", tone: "bad" },
};

export const ROUTE_STATUS = {
  DRAFT: { label: "Nháp", tone: "neutral", hint: "Còn có thể tối ưu lại" },
  LOCKED: { label: "Đã chốt", tone: "plan", hint: "Thứ tự giao cố định, chờ xuất kho" },
  IN_PROGRESS: { label: "Đang chạy", tone: "move", hint: "Xe đã xuất kho" },
  DONE: { label: "Hoàn tất", tone: "ok", hint: "Đã giao hết các điểm" },
};

export const PAYMENT_METHOD = { COD: "Tiền mặt khi nhận", COUNTER_CASH: "Tiền mặt tại quầy", BANK: "Chuyển khoản", EWALLET: "Ví điện tử" };

class PermissionError extends Error {}

export function StoreProvider({ children }) {
  const [state, setState] = useState(null);
  const [toasts, setToasts] = useState([]);
  const stateRef = useRef(null);
  stateRef.current = state;

  useEffect(() => {
    setState(load());
  }, []);
  // Danh mục công khai lấy từ API khi backend/MySQL sẵn sàng; nếu chưa chạy thì
  // giữ dữ liệu mẫu để giao diện demo vẫn mở được.
  useEffect(() => {
    if (!state?.seedDate) return undefined;
    let cancelled = false;
    api("/api/products")
      .then((products) => {
        if (!cancelled && Array.isArray(products)) {
          setState((current) => current ? { ...current, products } : current);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [state?.seedDate]);
  useEffect(() => {
    if (state) save(state);
  }, [state]);

  const toast = useCallback((message, tone = "ok") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const value = useMemo(() => {
    if (!state) return { ready: false, toasts, toast };
    const user = state.session ? state.users.find((u) => u.id === state.session.userId && u.active) : null;
    const role = user?.role || null;
    const allowed = (perm) => can(state.roleMatrix, role, perm);

    // Chạy một thay đổi trên bản sao trạng thái. fn có thể trả về kết quả.
    function mutate(fn) {
      const draft = structuredClone(stateRef.current);
      const result = fn(draft);
      stateRef.current = draft;
      setState(draft);
      return result;
    }
    function need(perm) {
      if (!allowed(perm)) throw new PermissionError("Tài khoản của bạn không có quyền thực hiện thao tác này.");
    }
    function log(d, action, detail) {
      d.audit.unshift({ at: new Date().toISOString(), user: user?.name || "Khách", role, action, detail });
      d.audit = d.audit.slice(0, 300);
    }
    function pushHistory(o, status, note) {
      o.status = status;
      o.history.push({ status, at: new Date().toISOString(), by: user?.name || "Hệ thống", note });
    }
    function notify(d, o, title, body) {
      d.notifications.unshift({ id: Date.now() + Math.random(), customerId: o.customerId, orderId: o.id, title, body, at: new Date().toISOString(), read: false });
    }
    // Bọc action: bắt lỗi quyền và hiện thông báo
    const act = (fn, okMsg) => (...args) => {
      try {
        const res = fn(...args);
        if (okMsg) toast(typeof okMsg === "function" ? okMsg(res, ...args) : okMsg);
        return res;
      } catch (e) {
        toast(e.message, "bad");
        return undefined;
      }
    };
    const findOrder = (d, id) => d.orders.find((o) => o.id === id);
    const productById = (id) => state.products.find((p) => p.id === id);

    const actions = {
      // ------------------------------------------------------------ tài khoản
      login(identifier, password) {
        const id = identifier.trim().toLowerCase();
        const u = stateRef.current.users.find((x) => x.email.toLowerCase() === id || x.phone === id);
        if (!u || u.password !== password) return { ok: false, error: "Email/số điện thoại hoặc mật khẩu chưa đúng." };
        if (!u.active) return { ok: false, error: "Tài khoản đã bị khoá. Liên hệ quản trị viên." };
        mutate((d) => {
          d.session = { userId: u.id, at: new Date().toISOString() };
          if (u.role !== "CUSTOMER") log(d, "Đăng nhập", `${u.email} (${ROLES[u.role].label})`);
        });
        return { ok: true, user: u };
      },
      logout() {
        mutate((d) => {
          d.session = null;
        });
      },
      register({ name, phone, email, password }) {
        const s = stateRef.current;
        if (s.users.some((u) => u.phone === phone || (email && u.email.toLowerCase() === email.toLowerCase())))
          return { ok: false, error: "Số điện thoại hoặc email đã được dùng cho một tài khoản khác." };
        mutate((d) => {
          let c = d.customers.find((x) => x.phone === phone);
          if (!c) {
            c = { id: Math.max(...d.customers.map((x) => x.id)) + 1, name, phone, email, createdAt: new Date().toISOString(), addresses: [] };
            d.customers.push(c);
          }
          const uid = Math.max(...d.users.map((x) => x.id)) + 1;
          d.users.push({ id: uid, name, email: email || `${phone}@khach.local`, phone, password, role: "CUSTOMER", active: true, customerId: c.id });
          d.session = { userId: uid, at: new Date().toISOString() };
        });
        return { ok: true };
      },
      updateProfile: act(({ name, email }) =>
        mutate((d) => {
          const u = d.users.find((x) => x.id === user.id);
          Object.assign(u, { name, email });
          const c = d.customers.find((x) => x.id === user.customerId);
          if (c) Object.assign(c, { name, email });
        }), "Đã lưu thông tin"),
      changePassword: act((oldPw, newPw) =>
        mutate((d) => {
          const u = d.users.find((x) => x.id === user.id);
          if (u.password !== oldPw) throw new Error("Mật khẩu hiện tại chưa đúng.");
          u.password = newPw;
        }), "Đã đổi mật khẩu"),
      saveAddress: act((addr) =>
        mutate((d) => {
          need("order.place");
          const c = d.customers.find((x) => x.id === user.customerId);
          if (addr.id) Object.assign(c.addresses.find((a) => a.id === addr.id), addr);
          else c.addresses.push({ ...addr, id: Math.max(0, ...c.addresses.map((a) => a.id)) + 1 });
        }), "Đã lưu địa chỉ"),
      removeAddress: act((id) =>
        mutate((d) => {
          const c = d.customers.find((x) => x.id === user.customerId);
          c.addresses = c.addresses.filter((a) => a.id !== id);
        })),

      // ------------------------------------------------------------ giỏ hàng & đặt hàng
      addToCart: act((productId, qty = 1) =>
        mutate((d) => {
          const line = d.cart.find((l) => l.productId === productId);
          if (line) line.qty = Math.min(line.qty + qty, 10);
          else d.cart.push({ productId, qty });
        }), "Đã thêm vào giỏ"),
      setCartQty: (productId, qty) =>
        mutate((d) => {
          if (qty <= 0) d.cart = d.cart.filter((l) => l.productId !== productId);
          else d.cart.find((l) => l.productId === productId).qty = Math.min(qty, 10);
        }),
      clearCart: () => mutate((d) => { d.cart = []; }),

      async placeOrder({ address, deliveryDate, window, paymentMethod, note, isGift = false, recipientName = "", recipientPhone = "", clientRequestId }) {
        try {
          need("order.place");
          const current = stateRef.current;
          if (!current.cart.length) throw new Error("Giỏ hàng đang trống.");
          if (deliveryDate < ymd()) throw new Error("Ngày giao không được ở quá khứ.");
          if (toMin(window.end) - toMin(window.start) < 60) throw new Error("Khung giờ nhận hàng cần dài ít nhất 1 tiếng.");
          if (isGift && (!recipientName.trim() || !recipientPhone.trim())) throw new Error("Nhập tên và số điện thoại người nhận quà.");
          const customer = current.customers.find((x) => x.id === user.customerId);
          const requestId = clientRequestId || crypto.randomUUID();
          const payload = {
            customer_name: customer.name,
            phone: customer.phone,
            recipient_name: isGift ? recipientName.trim() : customer.name,
            recipient_phone: isGift ? recipientPhone.trim() : customer.phone,
            is_gift: isGift,
            client_request_id: requestId,
            address: address.address,
            lat: address.lat == null || address.lat === "" ? undefined : Number(address.lat),
            lng: address.lng == null || address.lng === "" ? undefined : Number(address.lng),
            delivery_date: deliveryDate,
            time_window_start: window.start,
            time_window_end: window.end,
            payment_method: paymentMethod === "BANK" ? "BANK_TRANSFER" : paymentMethod,
            note: note || undefined,
            items: current.cart.map((line) => ({ product_id: line.productId, quantity: line.qty })),
          };
          const saved = await api("/api/orders", { method: "POST", body: payload });
          let created;
          mutate((d) => {
            const existing = d.orders.find((o) => o.serverId === saved.id);
            if (existing) {
              created = existing;
              d.cart = [];
              return;
            }
            const c = d.customers.find((x) => x.id === user.customerId);
            const id = Math.max(0, ...d.orders.map((o) => o.id)) + 1;
            created = mapServerOrder(saved, id, c.id);
            created.district = address.district || "";
            created.note = note || "";
            d.orders.push(created);
            for (const item of created.items) {
              const p = d.products.find((product) => product.id === item.productId);
              if (p) p.stock = Math.max(0, p.stock - item.qty);
            }
            d.cart = [];
            notify(d, created, "Đã nhận đơn", `Thông Vân đã nhận đơn ${created.code}. Nhân viên sẽ gọi xác nhận trong ít phút.`);
          });
          toast("Đã tạo đơn hàng");
          return created;
        } catch (error) {
          toast(error.message || "Không tạo được đơn hàng.", "bad");
          return null;
        }
      },

      cancelOwnOrder: act((orderId) =>
        mutate((d) => {
          need("order.track_own");
          const o = findOrder(d, orderId);
          if (o.customerId !== user.customerId) throw new Error("Không tìm thấy đơn hàng.");
          if (o.serverId) throw new Error("Đơn đã lưu trên máy chủ. Vui lòng gọi cửa hàng để yêu cầu huỷ đơn.");
          if (o.status !== "PENDING") throw new Error("Đơn đã được xác nhận, vui lòng gọi hotline để huỷ.");
          pushHistory(o, "CANCELLED", "Khách tự huỷ");
        }), "Đã huỷ đơn"),

      markNotificationsRead: () =>
        mutate((d) => {
          d.notifications.forEach((n) => {
            if (n.customerId === user?.customerId) n.read = true;
          });
        }),

      // ------------------------------------------------------------ xử lý đơn (nhân viên)
      async confirmOrders(ids) {
        try {
          need("order.confirm");
          let n = 0, skippedPayment = 0;
          for (const id of ids) {
            const order = stateRef.current.orders.find((x) => x.id === id);
            if (!order || order.status !== "PENDING") continue;
            if (order.payment.method === "BANK" && order.payment.status !== "PAID") { skippedPayment++; continue; }
            let serverOrder;
            if (order.serverId) {
              const token = loadToken();
              if (!token) throw new Error("Nhập staff token trong Quản trị sản phẩm để xử lý đơn trên máy chủ.");
              serverOrder = await api(`/api/orders/${order.serverId}/status`, { method: "PATCH", body: { status: "CONFIRMED" }, token });
            }
            mutate((d) => {
              const current = findOrder(d, id);
              pushHistory(current, serverOrder?.status || "CONFIRMED");
              notify(d, current, "Đơn đã được xác nhận", `Đơn ${current.code} đã được xác nhận và đang chuẩn bị hàng.`);
              log(d, "Xác nhận đơn", current.code);
            });
            n++;
          }
          toast(skippedPayment ? `Đã xác nhận ${n} đơn; ${skippedPayment} đơn cần đối soát chuyển khoản trước` : `Đã xác nhận ${n} đơn`, skippedPayment && !n ? "bad" : "ok");
          return n;
        } catch (error) {
          toast(error.message || "Không xác nhận được đơn.", "bad");
          return 0;
        }
      },
      async markReady(ids) {
        try {
          need("order.confirm");
          let n = 0, skipped = 0;
          for (const id of ids) {
            const order = stateRef.current.orders.find((x) => x.id === id);
            if (!order || order.status !== "CONFIRMED") continue;
            if (order.lat == null) { skipped++; continue; }
            let serverOrder;
            if (order.serverId) {
              const token = loadToken();
              if (!token) throw new Error("Nhập staff token trong Quản trị sản phẩm để xử lý đơn trên máy chủ.");
              serverOrder = await api(`/api/orders/${order.serverId}/status`, { method: "PATCH", body: { status: "READY" }, token });
            }
            mutate((d) => {
              const current = findOrder(d, id);
              pushHistory(current, serverOrder?.status || "READY");
              log(d, "Chuẩn bị xong hàng", current.code);
            });
            n++;
          }
          if (!n && skipped) throw new Error("Đơn chưa có vị trí giao. Cập nhật vị trí trước khi chuyển sang sẵn sàng giao.");
          toast(`${n} đơn sẵn sàng giao`);
          return n;
        } catch (error) {
          toast(error.message || "Không chuyển được trạng thái đơn.", "bad");
          return 0;
        }
      },
      async markOrderPaid(id) {
        try {
          need("order.confirm");
          const order = stateRef.current.orders.find((x) => x.id === id);
          if (!order) throw new Error("Không tìm thấy đơn.");
          if (order.payment.method !== "BANK") throw new Error("Đơn này không thanh toán bằng chuyển khoản.");
          if (order.serverId) {
            const token = loadToken();
            if (!token) throw new Error("Nhập staff token trong Quản trị sản phẩm để xác nhận thanh toán.");
            await api(`/api/orders/${order.serverId}/payment`, { method: "PATCH", body: { status: "PAID" }, token });
          }
          mutate((d) => {
            const current = findOrder(d, id);
            current.payment.status = "PAID";
            current.history.push({ status: current.status, at: new Date().toISOString(), by: user?.name || "Nhân viên", note: "Đã xác nhận nhận tiền chuyển khoản" });
            log(d, "Xác nhận chuyển khoản", current.code);
          });
          toast("Đã xác nhận nhận tiền");
          return true;
        } catch (error) {
          toast(error.message || "Không xác nhận được thanh toán.", "bad");
          return false;
        }
      },
      async cancelOrder(id, reason) {
        try {
          need("order.cancel");
          const order = stateRef.current.orders.find((x) => x.id === id);
          if (!order || !["PENDING", "CONFIRMED", "READY"].includes(order.status)) throw new Error("Chỉ huỷ được đơn chưa xếp tuyến.");
          let serverOrder;
          if (order.serverId) {
            const token = loadToken();
            if (!token) throw new Error("Nhập staff token trong Quản trị sản phẩm để xử lý đơn trên máy chủ.");
            serverOrder = await api(`/api/orders/${order.serverId}/status`, { method: "PATCH", body: { status: "CANCELLED", reason }, token });
          }
          mutate((d) => {
            const current = findOrder(d, id);
            pushHistory(current, serverOrder?.status || "CANCELLED", reason);
            if (current.serverId && current.inventoryReserved) {
              for (const item of current.items) {
                const product = d.products.find((p) => p.id === item.productId);
                if (product) product.stock += item.qty;
              }
            }
            notify(d, current, "Đơn đã bị huỷ", `Đơn ${current.code} đã được huỷ. Lý do: ${reason}.`);
            log(d, "Huỷ đơn", `${current.code}: ${reason}`);
          });
          toast("Đã huỷ đơn");
          return true;
        } catch (error) {
          toast(error.message || "Không huỷ được đơn.", "bad");
          return false;
        }
      },
      async requestOrderInfo(id, message) {
        try {
          need("order.confirm");
          const order = stateRef.current.orders.find((x) => x.id === id);
          if (!order || !["PENDING", "CONFIRMED"].includes(order.status)) throw new Error("Chỉ yêu cầu bổ sung thông tin cho đơn đang xử lý.");
          if (order.serverId) {
            const token = loadToken();
            if (!token) throw new Error("Nhập staff token trong Quản trị sản phẩm để xử lý đơn trên máy chủ.");
            await api(`/api/orders/${order.serverId}/request-info`, { method: "POST", body: { message }, token });
          }
          mutate((d) => {
            const current = findOrder(d, id);
            current.history.push({ status: current.status, at: new Date().toISOString(), by: user?.name || "Nhân viên", note: `Yêu cầu bổ sung: ${message}` });
            current.requestedInfo ||= [];
            current.requestedInfo.push({ message, at: new Date().toISOString() });
            notify(d, current, "Cần bổ sung thông tin", message);
            log(d, "Yêu cầu bổ sung thông tin", current.code);
          });
          toast("Đã gửi yêu cầu bổ sung thông tin");
          return true;
        } catch (error) {
          toast(error.message || "Không gửi được yêu cầu.", "bad");
          return false;
        }
      },
      async setOrderLocation(id, lat, lng, address) {
        try {
          need("order.edit_location");
          const order = stateRef.current.orders.find((x) => x.id === id);
          if (!order || ["SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(order.status)) throw new Error("Đơn đã xếp tuyến, không sửa được vị trí.");
          if (order.serverId) {
            const token = loadToken();
            if (!token) throw new Error("Nhập staff token trong Quản trị sản phẩm để sửa vị trí trên máy chủ.");
            await api(`/api/orders/${order.serverId}/location`, { method: "PATCH", body: { lat, lng, address }, token });
          }
          mutate((d) => {
            const current = findOrder(d, id);
            Object.assign(current, { lat, lng });
            if (address) current.address = address;
            log(d, "Sửa vị trí giao", `${current.code}: ${lat}, ${lng}`);
          });
          toast("Đã cập nhật vị trí");
          return true;
        } catch (error) {
          toast(error.message || "Không cập nhật được vị trí.", "bad");
          return false;
        }
      },

      // ------------------------------------------------------------ sản phẩm
      async loadProducts(token = loadToken()) {
        try {
          const products = await api(token ? "/api/products/admin" : "/api/products", { token });
          if (!Array.isArray(products)) throw new Error("Dữ liệu sản phẩm từ máy chủ không hợp lệ.");
          mutate((d) => { d.products = products; });
          return true;
        } catch (error) {
          toast(error.message || "Không tải được sản phẩm từ máy chủ.", "bad");
          return false;
        }
      },
      async loadOrders(token = loadToken()) {
        if (!token) return false;
        try {
          const rows = await api("/api/orders", { token });
          if (!Array.isArray(rows)) throw new Error("Dữ liệu đơn hàng từ máy chủ không hợp lệ.");
          mutate((d) => {
            const prior = new Map(d.orders.filter((o) => o.serverId).map((o) => [o.serverId, o]));
            const codes = new Set(rows.map((o) => o.code));
            d.orders = d.orders.filter((o) => o.serverId || !codes.has(o.code));
            let nextId = Math.max(0, ...d.orders.map((o) => o.id));
            for (const row of rows) {
              const previous = prior.get(row.id);
              const matching = d.orders.find((o) => o.code === row.code);
              const localId = previous?.id || matching?.id || ++nextId;
              const customerId = d.customers.find((c) => c.phone === row.phone)?.id || 0;
              const mapped = mapServerOrder(row, localId, customerId);
              if (previous) {
                const i = d.orders.findIndex((o) => o.serverId === row.id);
                if (i >= 0) d.orders[i] = mapped;
                else d.orders.push(mapped);
              } else if (matching) {
                const i = d.orders.findIndex((o) => o.id === matching.id);
                d.orders[i] = mapped;
              } else d.orders.push(mapped);
            }
          });
          return true;
        } catch (error) {
          toast(error.message || "Không tải được đơn hàng từ máy chủ.", "bad");
          return false;
        }
      },
      async createCounterOrder({ customerName, phone, address, lat, lng, deliveryDate, window, paymentMethod, note, items, clientRequestId }) {
        try {
          need("order.confirm");
          const token = loadToken();
          if (!token) throw new Error("Nhập staff token trong Quản trị sản phẩm để tạo đơn tại quầy.");
          const saved = await api("/api/orders/counter", {
            method: "POST",
            token,
            body: {
              customer_name: customerName,
              phone,
              recipient_name: customerName,
              recipient_phone: phone,
              is_gift: false,
              client_request_id: clientRequestId || crypto.randomUUID(),
              address,
              lat: lat == null || lat === "" ? undefined : Number(lat),
              lng: lng == null || lng === "" ? undefined : Number(lng),
              delivery_date: deliveryDate,
              time_window_start: window.start,
              time_window_end: window.end,
              payment_method: paymentMethod === "BANK" ? "BANK_TRANSFER" : paymentMethod,
              note: note || undefined,
              items,
            },
          });
          let created;
          mutate((d) => {
            const existing = d.orders.find((o) => o.serverId === saved.id);
            if (existing) {
              created = existing;
              return;
            }
            const localId = Math.max(0, ...d.orders.map((o) => o.id)) + 1;
            const customerId = d.customers.find((c) => c.phone === phone)?.id || 0;
            created = mapServerOrder(saved, localId, customerId);
            d.orders.push(created);
            for (const item of created.items) {
              const product = d.products.find((p) => p.id === item.productId);
              if (product) product.stock = Math.max(0, product.stock - item.qty);
            }
            notify(d, created, "Đã nhận đơn tại quầy", `Đơn ${created.code} đã được tạo.`);
            log(d, "Nhập đơn tại quầy", created.code);
          });
          toast("Đã tạo đơn tại quầy");
          return created;
        } catch (error) {
          toast(error.message || "Không tạo được đơn tại quầy.", "bad");
          return null;
        }
      },
      async saveProduct(p) {
        try {
          need("product.manage");
          const token = loadToken();
          if (!token) throw new Error("Nhập staff token để lưu sản phẩm vào máy chủ.");
          const saved = await api(p.id ? `/api/products/admin/${p.id}` : "/api/products/admin", {
            method: p.id ? "PATCH" : "POST", body: p, token,
          });
          mutate((d) => {
            const index = d.products.findIndex((x) => x.id === saved.id);
            if (index >= 0) d.products[index] = saved;
            else d.products.push(saved);
            log(d, p.id ? "Sửa sản phẩm" : "Thêm sản phẩm", saved.name);
          });
          toast("Đã lưu sản phẩm");
          return saved;
        } catch (error) {
          toast(error.message || "Không lưu được sản phẩm.", "bad");
          return null;
        }
      },
      async toggleProduct(id) {
        try {
          need("product.manage");
          const token = loadToken();
          if (!token) throw new Error("Nhập staff token để cập nhật sản phẩm.");
          const product = stateRef.current.products.find((x) => x.id === id);
          if (!product) throw new Error("Không tìm thấy sản phẩm.");
          const saved = await api(`/api/products/admin/${id}/visibility`, {
            method: "PATCH", body: { active: !product.active }, token,
          });
          mutate((d) => {
            const index = d.products.findIndex((x) => x.id === saved.id);
            if (index >= 0) d.products[index] = saved;
            log(d, saved.active ? "Mở bán sản phẩm" : "Ẩn sản phẩm", saved.name);
          });
          toast(saved.active ? "Đã mở bán" : "Đã ẩn sản phẩm");
          return saved.active;
        } catch (error) {
          toast(error.message || "Không cập nhật được sản phẩm.", "bad");
          return false;
        }
      },

      // ------------------------------------------------------------ tối ưu & tuyến
      optimizeDay: act((date, vehicleIds) =>
        mutate((d) => {
          need("route.optimize");
          // tuyến nháp cũ -> trả đơn về READY để tối ưu lại; tuyến đã chốt giữ nguyên
          d.routes.filter((r) => r.date === date && r.status === "DRAFT").forEach((r) =>
            r.stops.forEach((s) => {
              const o = findOrder(d, s.orderId);
              o.status = "READY";
              o.history = o.history.filter((h) => h.status !== "SCHEDULED");
            }));
          d.routes = d.routes.filter((r) => !(r.date === date && r.status === "DRAFT"));
          const busy = new Set(d.routes.filter((r) => r.date === date).map((r) => r.vehicleId));
          const busyDrivers = new Set(d.routes.filter((r) => r.date === date).map((r) => r.driverId));
          const vehicles = d.vehicles.filter((v) => v.active && vehicleIds.includes(v.id) && !busy.has(v.id));
          if (!vehicles.length) throw new Error("Không còn xe trống. Chọn xe khác hoặc mở lại tuyến đã chốt.");
          const freeDrivers = d.drivers.filter((x) => x.active && !busyDrivers.has(x.id));
          const ready = d.orders.filter((o) => o.deliveryDate === date && o.status === "READY");
          const located = ready.filter((o) => o.lat != null);
          if (!located.length) throw new Error("Chưa có đơn sẵn sàng giao cho ngày này.");
          const prod = (id) => d.products.find((p) => p.id === id);
          const stops = located.map((o) => ({
            id: o.id, order: o.id, lat: o.lat, lng: o.lng,
            twStart: toMin(o.window.start), twEnd: toMin(o.window.end),
            service: d.settings.unloadMin + o.items.reduce((s, it) => s + prod(it.productId).install * it.qty, 0),
            volume: o.items.reduce((s, it) => s + prod(it.productId).volume * it.qty, 0),
          }));
          const res = optimize(d.settings.depot, stops,
            vehicles.map((v, i) => ({ id: v.id, capacity: v.capacity, driverId: freeDrivers[i]?.id ?? null })),
            { dayStart: toMin(d.settings.dayStart), dayEnd: toMin(d.settings.dayEnd), wKm: d.settings.wKm, wTime: d.settings.wTime, roadFactor: d.settings.roadFactor, speed: d.settings.speed });
          let rid = Math.max(0, ...d.routes.map((r) => r.id));
          const created = res.plans.map((p) => {
            rid++;
            p.stops.forEach((s) => {
              const o = findOrder(d, s.orderId);
              pushHistory(o, "SCHEDULED");
              notify(d, o, "Đã xếp lịch giao", `Đơn ${o.code} dự kiến giao khoảng ${hm(etaWindow(s.arrival, s.seq).start)}–${hm(etaWindow(s.arrival, s.seq).end)}. Lịch có thể điều chỉnh trước khi chốt.`);
            });
            return {
              id: rid, code: `R${date.slice(5).replace("-", "")}-${p.vehicleId}`, date,
              vehicleId: p.vehicleId, driverId: p.driverId, status: "DRAFT",
              totalKm: p.totalKm, totalMin: p.totalMin, baselineKm: p.baselineKm, solver: "heuristic",
              createdAt: new Date().toISOString(),
              stops: p.stops.map((s) => {
                const e = etaWindow(s.arrival, s.seq);
                return { orderId: s.orderId, seq: s.seq, planned: s.arrival, etaStart: e.start, etaEnd: e.end, arrivedAt: null, completedAt: null, result: null };
              }),
            };
          });
          d.routes.push(...created);
          const summary = {
            routes: created.map((r) => r.id),
            orders: located.length - res.unassigned.length,
            unassigned: res.unassigned.map((id) => findOrder(d, id).code),
            missing: ready.filter((o) => o.lat == null).map((o) => o.code),
            totalKm: res.totalKm, baselineKm: res.baselineKm, savingPercent: res.savingPercent, ms: res.ms,
          };
          log(d, "Tối ưu tuyến", `${date}: ${summary.orders} đơn, ${created.length} tuyến, tiết kiệm ${summary.savingPercent}% km`);
          return summary;
        })),
      assignDriver: act((routeId, driverId) =>
        mutate((d) => {
          need("route.dispatch");
          const r = d.routes.find((x) => x.id === routeId);
          if (!["DRAFT", "LOCKED"].includes(r.status)) throw new Error("Tuyến đã xuất kho, không đổi được tài xế.");
          if (d.routes.some((x) => x.id !== routeId && x.date === r.date && x.driverId === driverId))
            throw new Error("Tài xế này đã có tuyến khác trong ngày.");
          r.driverId = driverId;
          log(d, "Phân công tài xế", `${r.code} → ${d.drivers.find((x) => x.id === driverId)?.name}`);
        }), "Đã phân công tài xế"),
      lockRoute: act((routeId) =>
        mutate((d) => {
          need("route.approve");
          const r = d.routes.find((x) => x.id === routeId);
          if (r.status !== "DRAFT") throw new Error("Chỉ chốt được tuyến nháp.");
          if (!r.driverId) throw new Error("Tuyến chưa có tài xế.");
          r.status = "LOCKED";
          r.lockedAt = new Date().toISOString();
          r.lockedBy = user.name;
          log(d, "Chốt tuyến", r.code);
        }), "Đã chốt tuyến. Thứ tự giao sẽ không thay đổi nữa."),
      unlockRoute: act((routeId) =>
        mutate((d) => {
          need("route.approve");
          const r = d.routes.find((x) => x.id === routeId);
          if (r.status !== "LOCKED") throw new Error("Chỉ mở lại được tuyến đã chốt và chưa xuất kho.");
          r.status = "DRAFT";
          log(d, "Mở lại tuyến", r.code);
        }), "Đã chuyển tuyến về nháp"),
      startRoute: act((routeId) =>
        mutate((d) => {
          need("route.dispatch");
          const r = d.routes.find((x) => x.id === routeId);
          if (r.status !== "LOCKED") throw new Error("Tuyến cần được chốt trước khi xuất kho.");
          r.status = "IN_PROGRESS";
          r.startedAt = new Date().toISOString();
          r.stops.forEach((s) => {
            const o = findOrder(d, s.orderId);
            pushHistory(o, "OUT_FOR_DELIVERY");
            notify(d, o, "Xe đã xuất kho", `Đơn ${o.code} đang được giao. Bạn là điểm giao thứ ${s.seq} trong tuyến.`);
          });
          log(d, "Xuất kho", r.code);
        }), "Xe đã xuất kho"),

      // ------------------------------------------------------------ tài xế
      arriveStop: act((routeId, orderId) =>
        mutate((d) => {
          need("delivery.update");
          const r = d.routes.find((x) => x.id === routeId);
          if (r.driverId !== user.driverId) throw new Error("Đây không phải tuyến của bạn.");
          if (r.status !== "IN_PROGRESS") throw new Error("Tuyến chưa xuất kho.");
          const s = r.stops.find((x) => x.orderId === orderId);
          s.arrivedAt = simulatedArrival(r, s);
        }), "Đã ghi nhận đến nơi"),
      completeStop: act((routeId, orderId, success, reason) =>
        mutate((d) => {
          need("delivery.update");
          const r = d.routes.find((x) => x.id === routeId);
          if (r.driverId !== user.driverId) throw new Error("Đây không phải tuyến của bạn.");
          if (r.status !== "IN_PROGRESS") throw new Error("Tuyến chưa xuất kho.");
          const s = r.stops.find((x) => x.orderId === orderId);
          const o = findOrder(d, orderId);
          s.arrivedAt = s.arrivedAt ?? simulatedArrival(r, s);
          const service = d.settings.unloadMin + o.items.reduce((sum, it) => sum + d.products.find((p) => p.id === it.productId).install * it.qty, 0);
          s.completedAt = s.arrivedAt + service;
          s.result = success ? "DELIVERED" : "FAILED";
          if (!success) o.failReason = reason;
          if (success && o.payment.method === "COD") o.payment.status = "PAID";
          pushHistory(o, s.result, reason);
          notify(d, o, success ? "Giao hàng thành công" : "Giao hàng chưa thành công",
            success ? `Đơn ${o.code} đã giao thành công. Cảm ơn bạn đã mua sắm tại Thông Vân.` : `Đơn ${o.code} chưa giao được: ${reason}. Cửa hàng sẽ liên hệ để hẹn lại.`);
          if (r.stops.every((x) => x.completedAt != null)) r.status = "DONE";
          return success;
        }), (ok) => (ok ? "Đã xác nhận giao thành công" : "Đã ghi nhận giao thất bại")),

      // ------------------------------------------------------------ đội xe
      saveDriver: act((x) =>
        mutate((d) => {
          need("fleet.manage");
          if (x.id) Object.assign(d.drivers.find((y) => y.id === x.id), x);
          else d.drivers.push({ ...x, id: Math.max(...d.drivers.map((y) => y.id)) + 1, active: true });
          log(d, "Lưu tài xế", x.name);
        }), "Đã lưu tài xế"),
      saveVehicle: act((x) =>
        mutate((d) => {
          need("fleet.manage");
          if (x.id) Object.assign(d.vehicles.find((y) => y.id === x.id), x);
          else d.vehicles.push({ ...x, id: Math.max(...d.vehicles.map((y) => y.id)) + 1, active: true });
          log(d, "Lưu xe", x.plate);
        }), "Đã lưu xe"),

      // ------------------------------------------------------------ người dùng & phân quyền
      saveUser: act((x) =>
        mutate((d) => {
          need("user.manage");
          if (d.users.some((u) => u.id !== x.id && u.email.toLowerCase() === x.email.toLowerCase())) throw new Error("Email đã được dùng.");
          if (x.id === user.id && x.role !== user.role) throw new Error("Không thể tự đổi vai trò của chính mình.");
          if (x.id) Object.assign(d.users.find((u) => u.id === x.id), x);
          else {
            const id = Math.max(...d.users.map((u) => u.id)) + 1;
            const nu = { ...x, id, active: true, password: x.password || "123456" };
            if (x.role === "DRIVER") {
              const did = Math.max(...d.drivers.map((y) => y.id)) + 1;
              d.drivers.push({ id: did, name: x.name, phone: x.phone, license: "B2", active: true, userId: id });
              nu.driverId = did;
            }
            d.users.push(nu);
          }
          log(d, x.id ? "Sửa tài khoản" : "Tạo tài khoản", `${x.email} (${ROLES[x.role].label})`);
        }), "Đã lưu tài khoản"),
      toggleUser: act((id) =>
        mutate((d) => {
          need("user.manage");
          if (id === user.id) throw new Error("Không thể tự khoá tài khoản của chính mình.");
          const u = d.users.find((x) => x.id === id);
          u.active = !u.active;
          log(d, u.active ? "Mở khoá tài khoản" : "Khoá tài khoản", u.email);
          return u.active;
        }), (on) => (on ? "Đã mở khoá tài khoản" : "Đã khoá tài khoản")),
      togglePermission: act((roleKey, perm) =>
        mutate((d) => {
          need("role.manage");
          if (LOCKED[roleKey]?.includes(perm)) throw new Error("Quyền này được khoá để tránh mất quyền quản trị.");
          const list = d.roleMatrix[roleKey];
          const on = !list.includes(perm);
          d.roleMatrix[roleKey] = on ? [...list, perm] : list.filter((p) => p !== perm);
          log(d, "Đổi phân quyền", `${ROLES[roleKey].label}: ${on ? "thêm" : "bỏ"} ${perm}`);
        })),
      resetMatrix: act(() =>
        mutate((d) => {
          need("role.manage");
          d.roleMatrix = buildSeed().roleMatrix;
          log(d, "Khôi phục phân quyền mặc định", "");
        }), "Đã khôi phục phân quyền mặc định"),

      saveSettings: act((s) =>
        mutate((d) => {
          need("settings.manage");
          d.settings = { ...d.settings, ...s };
          log(d, "Đổi cài đặt", Object.keys(s).join(", "));
        }), "Đã lưu cài đặt"),

      resetDemo: () => {
        const fresh = buildSeed();
        fresh.session = stateRef.current.session;
        stateRef.current = fresh;
        setState(fresh);
        toast("Đã khôi phục dữ liệu mẫu");
      },
    };

    return { ready: true, state, user, role, can: allowed, actions, toasts, toast, productById };
  }, [state, toasts, toast]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

// Giờ đến mô phỏng: nối tiếp điểm trước + thời gian di chuyển theo kế hoạch,
// để bản demo cho ra giờ hợp lý dù đang mở lúc nào trong ngày.
function simulatedArrival(route, stop) {
  const prev = route.stops.filter((x) => x.seq < stop.seq && x.completedAt != null).sort((a, b) => b.seq - a.seq)[0];
  const prevPlanned = route.stops.find((x) => x.seq === stop.seq - 1);
  if (!prev) return stop.planned + Math.round(Math.random() * 10);
  const travel = prevPlanned ? Math.max(5, stop.planned - prevPlanned.planned - 20) : 10;
  return Math.max(prev.completedAt + travel, stop.planned - 20);
}

export function useStore() {
  return useContext(StoreCtx);
}

// ---------------------------------------------------------------- truy vấn dùng chung

export function routeOfOrder(state, orderId) {
  return state.routes.find((r) => r.stops.some((s) => s.orderId === orderId)) || null;
}

// "Còn N đơn trước bạn": chỉ trả về số, không lộ thông tin đơn khác
export function queueInfo(state, order) {
  const route = routeOfOrder(state, order.id);
  if (!route) return null;
  const stop = route.stops.find((s) => s.orderId === order.id);
  const remaining = route.stops.filter((s) => s.completedAt == null);
  const before = remaining.filter((s) => s.seq < stop.seq);
  let lag = 0;
  const lastArrived = route.stops.filter((s) => s.arrivedAt != null).sort((a, b) => b.seq - a.seq)[0];
  if (route.status === "IN_PROGRESS" && lastArrived) lag = Math.max(0, lastArrived.arrivedAt - lastArrived.planned);
  return {
    route,
    stop,
    done: stop.completedAt != null,
    position: before.length + 1,
    total: remaining.length,
    before: before.length,
    totalStops: route.stops.length,
    completedCount: route.stops.length - remaining.length,
    etaStart: stop.etaStart + lag,
    etaEnd: stop.etaEnd + lag,
    lag,
    locked: route.status !== "DRAFT",
    // các điểm khác chỉ là trạng thái ẩn danh để vẽ dải lộ trình
    strip: route.stops.map((s) => ({ seq: s.seq, me: s.orderId === order.id, done: s.completedAt != null, here: s.arrivedAt != null && s.completedAt == null })),
  };
}

export function dayStats(state, date) {
  const orders = state.orders.filter((o) => o.deliveryDate === date);
  const routes = state.routes.filter((r) => r.date === date);
  const stops = routes.flatMap((r) => r.stops);
  const completed = stops.filter((s) => s.completedAt != null);
  const onTime = completed.filter((s) => {
    const o = state.orders.find((x) => x.id === s.orderId);
    return s.arrivedAt <= toMin(o.window.end);
  });
  const km = routes.reduce((s, r) => s + r.totalKm, 0);
  const baseline = routes.reduce((s, r) => s + (r.baselineKm || r.totalKm), 0);
  return {
    orders: orders.length,
    revenue: orders.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + o.total, 0),
    delivered: orders.filter((o) => o.status === "DELIVERED").length,
    failed: orders.filter((o) => o.status === "FAILED").length,
    cancelled: orders.filter((o) => o.status === "CANCELLED").length,
    routes: routes.length,
    km,
    baseline,
    savedKm: Math.max(0, baseline - km),
    onTimeRate: completed.length ? onTime.length / completed.length : null,
    completed: completed.length,
  };
}

export { addDays };
