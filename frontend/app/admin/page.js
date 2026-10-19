"use client";

import Link from "next/link";
import { dayStats, useStore } from "@/lib/store";
import { addDays, dateTime, num, shortDate, vnd, vndShort, ymd } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import Bars from "@/components/Bars";
import { Kpi, OrderBadge, RouteBadge } from "@/components/ui";

function Dashboard() {
  const { state, user, can } = useStore();
  const today = ymd();
  const t = dayStats(state, today);
  const last7 = Array.from({ length: 7 }, (_, i) => dayStats(state, addDays(today, -7 + i)));
  const saved7 = last7.reduce((s, d) => s + d.savedKm, 0);
  const base7 = last7.reduce((s, d) => s + d.baseline, 0);
  const onTime = last7.filter((d) => d.onTimeRate != null);
  const onTimeRate = onTime.reduce((s, d) => s + d.onTimeRate * d.completed, 0) / Math.max(1, onTime.reduce((s, d) => s + d.completed, 0));
  const series = Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, -13 + i);
    return { label: shortDate(d), value: state.orders.filter((o) => o.deliveryDate === d && o.status !== "CANCELLED").length };
  });

  const todayRoutes = state.routes.filter((r) => r.date === today);
  const pending = state.orders.filter((o) => o.status === "PENDING");
  const readyToday = state.orders.filter((o) => o.status === "READY" && o.deliveryDate === today);
  const drafts = todayRoutes.filter((r) => r.status === "DRAFT");
  const locked = todayRoutes.filter((r) => r.status === "LOCKED");
  const noLoc = state.orders.filter((o) => o.lat == null && ["PENDING", "CONFIRMED"].includes(o.status));
  const todo = [
    can("order.confirm") && pending.length > 0 && { text: `${pending.length} đơn chờ xác nhận`, href: "/admin/orders?status=PENDING", cta: "Xác nhận" },
    can("order.edit_location") && noLoc.length > 0 && { text: `${noLoc.length} đơn chưa có vị trí giao`, href: "/admin/orders?status=NOLOC", cta: "Cập nhật", warn: true },
    can("route.optimize") && readyToday.length > 0 && { text: `${readyToday.length} đơn hôm nay sẵn sàng nhưng chưa xếp tuyến`, href: "/admin/dispatch", cta: "Tối ưu tuyến" },
    can("route.approve") && drafts.length > 0 && { text: `${drafts.length} tuyến nháp chờ duyệt`, href: "/admin/dispatch", cta: "Duyệt" },
    can("route.dispatch") && locked.length > 0 && { text: `${locked.length} tuyến đã chốt chờ xuất kho`, href: "/admin/dispatch", cta: "Xuất kho" },
  ].filter(Boolean);

  const recent = [...state.orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 6);

  return (
    <>
      <PageHead title={`Chào ${user.name.split(" ").slice(-1)[0]}`} sub="Tình hình giao hàng hôm nay và những việc cần xử lý." />
      <div className="kpis" style={{ marginBottom: 16 }}>
        <Kpi accent label="Đơn giao hôm nay" value={t.orders} delta={`${t.delivered} đã giao, ${t.routes} tuyến`} />
        <Kpi label="Doanh thu đơn hôm nay" value={vndShort(t.revenue)} delta="Không tính đơn huỷ" />
        <Kpi label="Giao đúng khung giờ (7 ngày)" value={`${Math.round(onTimeRate * 100)}%`} delta={`${onTime.reduce((s, d) => s + d.completed, 0)} điểm giao`} up />
        <Kpi label="Km tiết kiệm nhờ tối ưu (7 ngày)" value={`${num(saved7, 0)} km`} delta={`${base7 ? Math.round((saved7 / base7) * 100) : 0}% so với giao theo thứ tự đặt`} up />
      </div>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <section className="panel">
          <div className="panel-head"><h3>Số đơn giao theo ngày</h3><span className="small muted">14 ngày, cột vàng là hôm nay</span></div>
          <div className="panel-body"><Bars data={series} /></div>
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Việc cần làm</h3></div>
          <div className="panel-body stack-sm">
            {todo.length === 0 && <p className="muted small">Không có việc tồn đọng trong phạm vi quyền của bạn.</p>}
            {todo.map((x) => (
              <div key={x.text} className="row between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line-soft)" }}>
                <span className={`small ${x.warn ? "" : ""}`} style={{ color: x.warn ? "var(--move)" : undefined, fontWeight: 600 }}>{x.text}</span>
                <Link className="btn secondary sm" href={x.href}>{x.cta}</Link>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h3>Tuyến hôm nay</h3>{can("dispatch.view") && <Link href="/admin/dispatch" className="small strong" style={{ color: "var(--road)" }}>Mở điều phối</Link>}</div>
          <div className="panel-body stack">
            {todayRoutes.length === 0 && <p className="muted small">Chưa có tuyến nào cho hôm nay.</p>}
            {todayRoutes.map((r) => {
              const done = r.stops.filter((s) => s.completedAt != null).length;
              const driver = state.drivers.find((d) => d.id === r.driverId);
              return (
                <div key={r.id} className="stack-sm">
                  <div className="row between">
                    <div className="row"><b>{r.code}</b><RouteBadge status={r.status} /></div>
                    <span className="small muted">{driver?.name || "Chưa có tài xế"}</span>
                  </div>
                  <div className="progress"><span style={{ width: `${(done / r.stops.length) * 100}%` }} /></div>
                  <div className="tiny muted">{done}/{r.stops.length} điểm · {r.totalKm} km · thủ công {r.baselineKm} km</div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Đơn mới nhất</h3><Link href="/admin/orders" className="small strong" style={{ color: "var(--road)" }}>Tất cả đơn</Link></div>
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/${o.id}`} className="strong">{o.code}</Link><div className="tiny muted">{dateTime(o.createdAt)}</div></td>
                    <td>{o.customerName}<div className="tiny muted">{o.district}</div></td>
                    <td className="num">{vnd(o.total)}</td>
                    <td><OrderBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

export default function AdminHome() {
  return <RequirePerm perm="dashboard.view"><Dashboard /></RequirePerm>;
}
