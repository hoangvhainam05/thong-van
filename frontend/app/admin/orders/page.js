"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ORDER_STATUS, routeOfOrder, useStore } from "@/lib/store";
import { addDays, dateLabel, vnd, ymd } from "@/lib/format";
import { Can, RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Empty, Field, Loading, Modal, OrderBadge, Seg, Tabs } from "@/components/ui";
import { api } from "@/lib/api";

const PAGE = 25;

function Orders() {
  const { state, can, actions } = useStore();
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("status") || "ALL");
  const [day, setDay] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState([]);
  const [page, setPage] = useState(1);
  const [counterOpen, setCounterOpen] = useState(false);
  const [counter, setCounter] = useState({ customerName: "", phone: "", address: "", deliveryDate: addDays(ymd(), 1), start: "08:00", end: "17:00", productId: "", quantity: 1, paymentMethod: "COUNTER_CASH", note: "" });
  const [bankAvailable, setBankAvailable] = useState(false);
  const [counterSaving, setCounterSaving] = useState(false);
  const [counterError, setCounterError] = useState("");
  const counterRequestId = useRef(null);
  const today = ymd();

  useEffect(() => { actions.loadOrders(); }, []);
  useEffect(() => {
    let active = true;
    api("/api/orders/payment-instructions")
      .then((details) => { if (active) setBankAvailable(Boolean(details?.configured)); })
      .catch(() => { if (active) setBankAvailable(false); });
    return () => { active = false; };
  }, []);

  const base = useMemo(() => {
    let l = [...state.orders];
    if (day === "today") l = l.filter((o) => o.deliveryDate === today);
    if (day === "tomorrow") l = l.filter((o) => o.deliveryDate === addDays(today, 1));
    if (day === "upcoming") l = l.filter((o) => o.deliveryDate >= today);
    if (q) {
      const k = q.toLowerCase();
      l = l.filter((o) => o.code.toLowerCase().includes(k) || o.customerName.toLowerCase().includes(k) || o.phone.includes(k) || o.address.toLowerCase().includes(k));
    }
    return l.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.orders, day, q, today]);

  const list = tab === "ALL" ? base : tab === "NOLOC" ? base.filter((o) => o.lat == null && !["CANCELLED", "DELIVERED"].includes(o.status)) : base.filter((o) => o.status === tab);
  const shown = list.slice(0, page * PAGE);
  const count = (st) => base.filter((o) => o.status === st).length;
  const selected = list.filter((o) => sel.includes(o.id));
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <>
      <PageHead title="Đơn hàng" sub="Xác nhận đơn, chuẩn bị hàng và theo dõi tình trạng giao.">
        <Can perm="order.confirm"><button className="btn" onClick={() => setCounterOpen(true)}>Tạo đơn tại quầy</button></Can>
        <input className="input" style={{ width: 260 }} placeholder="Tìm mã đơn, tên, SĐT, địa chỉ" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Tìm đơn" />
        <Seg value={day} onChange={(v) => { setDay(v); setPage(1); }} items={[
          { value: "all", label: "Tất cả ngày" }, { value: "today", label: "Hôm nay" },
          { value: "tomorrow", label: "Ngày mai" }, { value: "upcoming", label: "Sắp giao" },
        ]} />
      </PageHead>

      <div className="panel">
        <div style={{ padding: "0 12px" }}>
          <Tabs value={tab} onChange={(v) => { setTab(v); setSel([]); setPage(1); }} items={[
            { value: "ALL", label: "Tất cả", count: base.length },
            ...["PENDING", "CONFIRMED", "READY", "SCHEDULED", "OUT_FOR_DELIVERY", "DELIVERED", "FAILED", "CANCELLED"].map((s) => ({ value: s, label: ORDER_STATUS[s].label, count: count(s) })),
            { value: "NOLOC", label: "Thiếu vị trí", count: base.filter((o) => o.lat == null && !["CANCELLED", "DELIVERED"].includes(o.status)).length },
          ]} />
        </div>
        {selected.length > 0 && (
          <div className="row" style={{ padding: "10px 16px", background: "var(--road-soft)", borderBottom: "1px solid var(--line)" }}>
            <b className="small">Đã chọn {selected.length} đơn</b>
            <Can perm="order.confirm">
              <button className="btn sm" disabled={!selected.some((o) => o.status === "PENDING" && (o.payment.method !== "BANK" || o.payment.status === "PAID"))} onClick={() => { actions.confirmOrders(selected.map((o) => o.id)); setSel([]); }}>Xác nhận</button>
              <button className="btn sm secondary" disabled={!selected.some((o) => o.status === "CONFIRMED")} onClick={() => { actions.markReady(selected.map((o) => o.id)); setSel([]); }}>Đã chuẩn bị hàng</button>
            </Can>
            <button className="btn ghost sm" onClick={() => setSel([])}>Bỏ chọn</button>
          </div>
        )}
        {list.length === 0 ? (
          <Empty title="Không có đơn nào">Thử đổi bộ lọc ngày hoặc trạng thái.</Empty>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {can("order.confirm") && <th style={{ width: 36 }}><input type="checkbox" aria-label="Chọn tất cả" checked={shown.length > 0 && shown.every((o) => sel.includes(o.id))} onChange={(e) => setSel(e.target.checked ? shown.map((o) => o.id) : [])} /></th>}
                  <th>Mã đơn</th><th>Khách hàng</th><th>Giao</th><th>Sản phẩm</th><th className="num">Tổng</th><th>Trạng thái</th><th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => {
                  const r = routeOfOrder(state, o.id);
                  const stop = r?.stops.find((s) => s.orderId === o.id);
                  return (
                    <tr key={o.id} className={sel.includes(o.id) ? "selected" : ""}>
                      {can("order.confirm") && <td><input type="checkbox" aria-label={`Chọn ${o.code}`} checked={sel.includes(o.id)} onChange={() => toggle(o.id)} /></td>}
                      <td><Link href={`/admin/orders/${o.id}`} className="strong" style={{ color: "var(--road)" }}>{o.code}</Link></td>
                      <td>{o.customerName}<div className="tiny muted">{o.phone}</div></td>
                      <td className="nowrap">
                        {dateLabel(o.deliveryDate)}<div className="tiny muted">{o.window.start}–{o.window.end}</div>
                        {o.lat == null && <div className="tiny" style={{ color: "var(--move)", fontWeight: 600 }}>Chưa có vị trí</div>}
                      </td>
                      <td className="small" style={{ maxWidth: 260 }}>{o.items.map((i) => i.name).join(", ")}</td>
                      <td className="num">{vnd(o.total)}<div className="tiny muted">{o.payment.method === "BANK" ? (o.payment.status === "PAID" ? "Đã chuyển khoản" : "Chờ chuyển khoản") : (o.payment.status === "PAID" ? "Đã thu tiền" : "COD")}</div></td>
                      <td><OrderBadge status={o.status} />{stop && <div className="tiny muted" style={{ marginTop: 4 }}>{r.code}, điểm {stop.seq}</div>}</td>
                      <td className="nowrap">
                        <Can perm="order.confirm">
                          {o.status === "PENDING" && (o.payment.method !== "BANK" || o.payment.status === "PAID") && <button className="btn sm" onClick={() => actions.confirmOrders([o.id])}>Xác nhận</button>}
                          {o.status === "PENDING" && o.payment.method === "BANK" && o.payment.status === "PENDING" && <Link className="btn sm secondary" href={`/admin/orders/${o.id}`}>Đối soát</Link>}
                          {o.status === "CONFIRMED" && <button className="btn sm secondary" onClick={() => actions.markReady([o.id])}>Sẵn sàng</button>}
                        </Can>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {shown.length < list.length && (
          <div className="row" style={{ justifyContent: "center", padding: 14 }}>
            <button className="btn secondary" onClick={() => setPage((p) => p + 1)}>Xem thêm ({list.length - shown.length} đơn)</button>
          </div>
        )}
      </div>

      {counterOpen && <Modal title="Tạo đơn mua tại quầy" onClose={() => setCounterOpen(false)}
        footer={<><button className="btn secondary" disabled={counterSaving} onClick={() => setCounterOpen(false)}>Huỷ</button><button className="btn" disabled={counterSaving} onClick={async () => {
          const product = state.products.find((p) => p.id === Number(counter.productId));
          if (!counter.customerName.trim() || !/^0\d{9,10}$/.test(counter.phone) || counter.address.trim().length < 5 || !product || Number(counter.quantity) < 1 || Number(counter.quantity) > 20 || counter.start < "08:00" || counter.end > "18:00" || (Number(counter.end.slice(0, 2)) * 60 + Number(counter.end.slice(3))) - (Number(counter.start.slice(0, 2)) * 60 + Number(counter.start.slice(3))) < 60) {
            setCounterError("Kiểm tra tên, số điện thoại, địa chỉ, sản phẩm, số lượng và khung giờ.");
            return;
          }
          setCounterError("");
          setCounterSaving(true);
          const order = await actions.createCounterOrder({
            customerName: counter.customerName.trim(), phone: counter.phone, address: counter.address.trim(),
            deliveryDate: counter.deliveryDate, window: { start: counter.start, end: counter.end },
            paymentMethod: counter.paymentMethod, note: counter.note,
            items: [{ product_id: product.id, quantity: Number(counter.quantity) }],
            clientRequestId: counterRequestId.current ||= crypto.randomUUID(),
          });
          setCounterSaving(false);
          if (order) { counterRequestId.current = null; setCounterOpen(false); }
        }}>{counterSaving ? "Đang lưu…" : "Tạo đơn"}</button></>}>
        <div className="form-grid">
          {counterError && <div className="notice bad full">{counterError}</div>}
          <Field label="Tên khách" full><input className="input" value={counter.customerName} onChange={(e) => setCounter({ ...counter, customerName: e.target.value })} /></Field>
          <Field label="Số điện thoại"><input className="input" inputMode="tel" value={counter.phone} onChange={(e) => setCounter({ ...counter, phone: e.target.value })} /></Field>
          <Field label="Ngày giao"><input className="input" type="date" min={today} value={counter.deliveryDate} onChange={(e) => setCounter({ ...counter, deliveryDate: e.target.value })} /></Field>
          <Field label="Địa chỉ giao" full><input className="input" value={counter.address} onChange={(e) => setCounter({ ...counter, address: e.target.value })} /></Field>
          <Field label="Sản phẩm"><select className="input" value={counter.productId} onChange={(e) => setCounter({ ...counter, productId: e.target.value })}><option value="">Chọn sản phẩm</option>{state.products.filter((p) => p.active).map((p) => <option key={p.id} value={p.id}>{p.name} · còn {p.stock}</option>)}</select></Field>
          <Field label="Số lượng"><input className="input" type="number" min="1" max="20" value={counter.quantity} onChange={(e) => setCounter({ ...counter, quantity: e.target.value })} /></Field>
          <Field label="Từ"><input className="input" type="time" value={counter.start} onChange={(e) => setCounter({ ...counter, start: e.target.value })} /></Field>
          <Field label="Đến"><input className="input" type="time" value={counter.end} onChange={(e) => setCounter({ ...counter, end: e.target.value })} /></Field>
          <Field label="Thanh toán"><select className="input" value={counter.paymentMethod} onChange={(e) => setCounter({ ...counter, paymentMethod: e.target.value })}><option value="COUNTER_CASH">Tiền mặt tại quầy</option><option value="COD">Tiền mặt khi nhận</option>{bankAvailable && <option value="BANK">Chuyển khoản</option>}</select></Field>
          <Field label="Ghi chú" full><input className="input" value={counter.note} onChange={(e) => setCounter({ ...counter, note: e.target.value })} /></Field>
          <p className="small muted full">Đơn quầy được kiểm tra tồn kho và quy tắc thanh toán như đơn trên website. Staff token phải được kết nối ở Quản trị sản phẩm.</p>
        </div>
      </Modal>}
    </>
  );
}

export default function OrdersPage() {
  return (
    <RequirePerm perm="order.view_all">
      <Suspense fallback={<Loading />}><Orders /></Suspense>
    </RequirePerm>
  );
}
