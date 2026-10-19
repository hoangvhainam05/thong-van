"use client";

// Kho dữ liệu phía trình duyệt cho bản demo giao diện.
// Mọi thao tác đi qua các hàm "action" bên dưới; mỗi action kiểm tra quyền trước khi
// đổi dữ liệu, giống cách backend sẽ làm. Khi nối API thật, chỉ cần thay thân các action.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { buildSeed } from "./mock/seed";
import { can, LOCKED, ROLES } from "./rbac";
import { addDays, hm, toMin, ymd } from "./format";
import { etaWindow, optimize } from "./optimizer";

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

export const PAYMENT_METHOD = { COD: "Tiền mặt khi nhận", BANK: "Chuyển khoản", EWALLET: "Ví điện tử" };

class PermissionError extends Error {}

export function StoreProvider({ children }) {
  const [state, setState] = useState(null);
  const [toasts, setToasts] = useState([]);
  const stateRef = useRef(null);
  stateRef.current = state;

  useEffect(() => {
    setState(load());
  }, []);
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

      placeOrder: act(({ address, deliveryDate, window, paymentMethod, note }) =>
        mutate((d) => {
          need("order.place");
          if (!d.cart.length) throw new Error("Giỏ hàng đang trống.");
          if (deliveryDate < ymd()) throw new Error("Ngày giao không được ở quá khứ.");
          if (toMin(window.end) - toMin(window.start) < 60) throw new Error("Khung giờ nhận hàng cần dài ít nhất 1 tiếng.");
          const c = d.customers.find((x) => x.id === user.customerId);
          const items = d.cart.map((l) => {
            const p = d.products.find((x) => x.id === l.productId);
            return { productId: p.id, name: p.name, price: p.price, qty: l.qty };
          });
          const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
          const shippingFee = subtotal >= d.settings.freeShipFrom ? 0 : d.settings.shippingFee;
          const id = Math.max(...d.orders.map((o) => o.id)) + 1;
          const now = new Date().toISOString();
          const o = {
            id,
            code: `TV${String(100000 + id * 7).slice(-6)}`,
            customerId: c.id, customerName: c.name, phone: c.phone,
            address: address.address, district: address.district || "", lat: address.lat ?? null, lng: address.lng ?? null,
            items, subtotal, shippingFee, total: subtotal + shippingFee,
            deliveryDate, window,
            payment: { method: paymentMethod, status: paymentMethod === "COD" ? "UNPAID" : "PAID" },
            note: note || "", status: "PENDING", createdAt: now,
            history: [{ status: "PENDING", at: now, by: "Khách hàng" }],
          };
          d.orders.push(o);
          items.forEach((it) => {
            const p = d.products.find((x) => x.id === it.productId);
            p.stock = Math.max(0, p.stock - it.qty);
          });
          d.cart = [];
          notify(d, o, "Đã nhận đơn", `Thông Vân đã nhận đơn ${o.code}. Nhân viên sẽ gọi xác nhận trong ít phút.`);
          return o;
        })),

      cancelOwnOrder: act((orderId) =>
        mutate((d) => {
          need("order.track_own");
          const o = findOrder(d, orderId);
          if (o.customerId !== user.customerId) throw new Error("Không tìm thấy đơn hàng.");
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
      confirmOrders: act((ids) =>
        mutate((d) => {
          need("order.confirm");
          let n = 0;
          ids.forEach((id) => {
            const o = findOrder(d, id);
            if (o.status !== "PENDING") return;
            pushHistory(o, "CONFIRMED");
            notify(d, o, "Đơn đã được xác nhận", `Đơn ${o.code} đã được xác nhận và đang chuẩn bị hàng.`);
            n++;
          });
          log(d, "Xác nhận đơn", `${n} đơn`);
          return n;
        }), (n) => `Đã xác nhận ${n} đơn`),
      markReady: act((ids) =>
        mutate((d) => {
          need("order.confirm");
          let n = 0, skipped = 0;
          ids.forEach((id) => {
            const o = findOrder(d, id);
            if (o.status !== "CONFIRMED") return;
            if (o.lat == null) { skipped++; return; }
            pushHistory(o, "READY");
            n++;
          });
          if (!n && skipped) throw new Error("Đơn chưa có vị trí giao. Cập nhật vị trí trước khi chuyển sang sẵn sàng giao.");
          log(d, "Chuẩn bị xong hàng", `${n} đơn`);
          return n;
        }), (n) => `${n} đơn sẵn sàng giao`),
      cancelOrder: act((id, reason) =>
        mutate((d) => {
          need("order.cancel");
          const o = findOrder(d, id);
          if (!["PENDING", "CONFIRMED", "READY"].includes(o.status)) throw new Error("Chỉ huỷ được đơn chưa xếp tuyến.");
          pushHistory(o, "CANCELLED", reason);
          notify(d, o, "Đơn đã bị huỷ", `Đơn ${o.code} đã được huỷ. Lý do: ${reason}.`);
          log(d, "Huỷ đơn", `${o.code}: ${reason}`);
        }), "Đã huỷ đơn"),
      setOrderLocation: act((id, lat, lng, address) =>
        mutate((d) => {
          need("order.edit_location");
          const o = findOrder(d, id);
          if (["SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED"].includes(o.status)) throw new Error("Đơn đã xếp tuyến, không sửa được vị trí.");
          Object.assign(o, { lat, lng });
          if (address) o.address = address;
          log(d, "Sửa vị trí giao", `${o.code}: ${lat}, ${lng}`);
        }), "Đã cập nhật vị trí"),

      // ------------------------------------------------------------ sản phẩm
      saveProduct: act((p) =>
        mutate((d) => {
          need("product.manage");
          if (p.id) Object.assign(d.products.find((x) => x.id === p.id), p);
          else {
            const id = Math.max(...d.products.map((x) => x.id)) + 1;
            d.products.push({ ...p, id, sku: p.sku || `TV-NEW-${id}`, rating: 0, sold: 0 });
          }
          log(d, p.id ? "Sửa sản phẩm" : "Thêm sản phẩm", p.name);
        }), "Đã lưu sản phẩm"),
      toggleProduct: act((id) =>
        mutate((d) => {
          need("product.manage");
          const p = d.products.find((x) => x.id === id);
          p.active = !p.active;
          log(d, p.active ? "Mở bán sản phẩm" : "Ẩn sản phẩm", p.name);
          return p.active;
        }), (on) => (on ? "Đã mở bán" : "Đã ẩn sản phẩm")),

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
