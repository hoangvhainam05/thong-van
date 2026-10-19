"use client";

import { useStore } from "@/lib/store";
import { dateLabel, toMin, ymd } from "@/lib/format";
import { Empty, RouteBadge } from "@/components/ui";

export default function DriverHistory() {
  const { state, user } = useStore();
  const routes = state.routes.filter((r) => r.driverId === user.driverId && r.date < ymd()).sort((a, b) => b.date.localeCompare(a.date));
  const stops = routes.flatMap((r) => r.stops.map((s) => ({ s, o: state.orders.find((o) => o.id === s.orderId) })));
  const delivered = stops.filter((x) => x.s.result === "DELIVERED");
  const onTime = delivered.filter((x) => x.s.arrivedAt <= toMin(x.o.window.end)).length;

  return (
    <div className="stack">
      <div className="kpis">
        <div className="kpi"><div className="label">Tuyến đã chạy</div><div className="value">{routes.length}</div></div>
        <div className="kpi"><div className="label">Đúng hẹn</div><div className="value">{delivered.length ? Math.round((onTime / delivered.length) * 100) : 0}%</div></div>
      </div>
      {routes.length === 0 ? <div className="panel"><Empty title="Chưa có lịch sử giao hàng" /></div> : (
        <div className="panel">
          {routes.map((r) => {
            const ok = r.stops.filter((s) => s.result === "DELIVERED").length;
            return (
              <div key={r.id} className="row between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
                <div><b>{dateLabel(r.date)}</b><div className="small muted">{r.code}, {r.totalKm} km</div></div>
                <div className="right"><RouteBadge status={r.status} /><div className="tiny muted">{ok}/{r.stops.length} điểm thành công</div></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
