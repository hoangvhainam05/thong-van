"use client";

import CancelOrderModal from "@/components/CancelOrderModal";

import Link from "next/link";
import { api, loadToken, resolveUrl } from "@/lib/api";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ORDER_STATUS, useStore } from "@/lib/store";
import { addDays, dateLabel, vnd, ymd } from "@/lib/format";
import { Can, RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Empty, Loading, OrderBadge, Seg, Tabs } from "@/components/ui";

const PAGE = 25;

function Orders() {
  const { state, can, actions } = useStore();
  const params = useSearchParams();
  const [supportRequests, setSupportRequests] = useState([]), [supportError, setSupportError] = useState('');
  useEffect(() => { api('/api/orders/payment-support', { token: loadToken() }).then(setSupportRequests).catch(e => setSupportError(e.message)); }, []);
  async function showSupportImage(id) {
    try { const response = await fetch(resolveUrl(`/api/orders/payment-support/${id}/image`), { headers: { Authorization: `Bearer ${loadToken()}` }, cache: 'no-store' }); if (!response.ok) throw new Error('Không tải được ảnh.'); const url = URL.createObjectURL(await response.blob()); window.open(url, '_blank', 'noopener,noreferrer'); setTimeout(() => URL.revokeObjectURL(url), 60000); } catch (e) { setSupportError(e.message); }
  }
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState(false);
  const [tab, setTab] = useState(params.get("status") || "ALL");
  const [day, setDay] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState([]);
  const [page, setPage] = useState(1);
  const [cancelOrder, setCancelOrder] = useState(null);
  const today = ymd();

  useEffect(() => { actions.loadOrders().then(ok => { setOrdersError(!ok); setOrdersLoading(false); }); }, []);

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

  if (ordersLoading) return <Loading />;
  if (ordersError) return <div className="notice bad">Không tải được đơn từ máy chủ. Vui lòng tải lại trang.</div>;
  return (
    <>
      <PageHead title="Đơn hàng" sub="Xác nhận đơn, chuẩn bị hàng và theo dõi tình trạng giao.">
        <input className="input" style={{ width: 260 }} placeholder="Tìm mã đơn, tên, SĐT, địa chỉ" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label="Tìm đơn" />
        <Seg value={day} onChange={(v) => { setDay(v); setPage(1); }} items={[
          { value: "all", label: "Tất cả ngày" }, { value: "today", label: "Hôm nay" },
          { value: "tomorrow", label: "Ngày mai" }, { value: "upcoming", label: "Sắp giao" },
        ]} />
      </PageHead>

      {(supportRequests.length > 0 || supportError) && <section className="panel panel-pad stack-sm"><h3>Yêu cầu hỗ trợ thanh toán</h3>{supportError && <div className="notice bad">{supportError}</div>}{supportRequests.map(r => <div key={r.id} className="notice"><Link href={`/admin/orders/${r.order_id}`}><b>Đơn {r.code}</b></Link><div>{r.message}</div>{r.has_image && <button className="btn secondary sm" onClick={() => showSupportImage(r.id)}>Xem ảnh giao dịch</button>}</div>)}</section>}
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
                      <td><OrderBadge status={o.status} />{o.routeId && <div className="tiny muted" style={{ marginTop: 4 }}>Tuyến {o.routeId}, điểm {o.sequence}</div>}</td>
                      <td className="nowrap">
                        <Can perm="order.confirm">
                          {o.status === "PENDING" && (o.payment.method !== "BANK" || o.payment.status === "PAID") && <button className="btn sm" onClick={() => actions.confirmOrders([o.id])}>Xác nhận</button>}
                          {o.status === "PENDING" && o.payment.method === "BANK" && o.payment.status === "PENDING" && <Link className="btn sm secondary" href={`/admin/orders/${o.id}`}>Đối soát</Link>}
                          {o.status === "CONFIRMED" && <button className="btn sm secondary" onClick={() => actions.markReady([o.id])}>Sẵn sàng</button>}
                        </Can>
                        <Can perm="order.cancel">{["PENDING", "CONFIRMED", "READY", "SCHEDULED", "FAILED"].includes(o.status) && <button className="btn ghost sm" onClick={() => setCancelOrder(o)}>Huỷ đơn</button>}</Can>
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

      {cancelOrder && <CancelOrderModal order={cancelOrder} onClose={() => setCancelOrder(null)} />}
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
