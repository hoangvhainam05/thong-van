"use client";

import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ORDER_STATUS, routeOfOrder, useStore } from "@/lib/store";
import { addDays, dateLabel, vnd, ymd } from "@/lib/format";
import { Can, RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Empty, Loading, OrderBadge, Seg, Tabs } from "@/components/ui";

const PAGE = 25;

function Orders() {
  const { state, can, actions } = useStore();
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get("status") || "ALL");
  const [day, setDay] = useState("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState([]);
  const [page, setPage] = useState(1);
  const today = ymd();

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
              <button className="btn sm" disabled={!selected.some((o) => o.status === "PENDING")} onClick={() => { actions.confirmOrders(selected.map((o) => o.id)); setSel([]); }}>Xác nhận</button>
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
                      <td className="num">{vnd(o.total)}<div className="tiny muted">{o.payment.status === "PAID" ? "Đã thanh toán" : "COD"}</div></td>
                      <td><OrderBadge status={o.status} />{stop && <div className="tiny muted" style={{ marginTop: 4 }}>{r.code}, điểm {stop.seq}</div>}</td>
                      <td className="nowrap">
                        <Can perm="order.confirm">
                          {o.status === "PENDING" && <button className="btn sm" onClick={() => actions.confirmOrders([o.id])}>Xác nhận</button>}
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
