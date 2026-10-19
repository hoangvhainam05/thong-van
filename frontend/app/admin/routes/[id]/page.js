"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { dateLabel, dateTime, hm, toMin } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import RouteMap from "@/components/RouteMap";
import { Empty, Kpi, OrderBadge, RouteBadge } from "@/components/ui";

function RouteDetail() {
  const { id } = useParams();
  const { state } = useStore();
  const r = state.routes.find((x) => x.id === Number(id));
  if (!r) return <div className="panel"><Empty title="Không tìm thấy tuyến" action={<Link href="/admin/dispatch" className="btn">Về điều phối</Link>} /></div>;
  const driver = state.drivers.find((d) => d.id === r.driverId);
  const vehicle = state.vehicles.find((v) => v.id === r.vehicleId);
  const rows = r.stops.map((s) => ({ s, o: state.orders.find((x) => x.id === s.orderId) }));
  const completed = rows.filter((x) => x.s.completedAt != null);
  const onTime = completed.filter((x) => x.s.arrivedAt <= toMin(x.o.window.end)).length;
  const saved = r.baselineKm ? Math.round(((r.baselineKm - r.totalKm) / r.baselineKm) * 100) : 0;

  return (
    <>
      <Link href="/admin/dispatch" className="small muted">‹ Điều phối giao hàng</Link>
      <PageHead title={`Tuyến ${r.code}`} sub={`${dateLabel(r.date)}, ${vehicle?.plate} (${vehicle?.type}), tài xế ${driver?.name || "chưa phân công"}`}>
        <RouteBadge status={r.status} />
      </PageHead>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <Kpi label="Số điểm giao" value={r.stops.length} delta={`${completed.length} đã hoàn tất`} />
        <Kpi label="Quãng đường" value={`${r.totalKm} km`} delta={`Thứ tự thủ công: ${r.baselineKm} km (${saved > 0 ? `−${saved}%` : "tương đương"})`} up={saved > 0} />
        <Kpi label="Thời gian dự kiến" value={`${Math.floor(r.totalMin / 60)}h${String(r.totalMin % 60).padStart(2, "0")}`} delta={`Xuất kho ${state.settings.dayStart}`} />
        <Kpi label="Đúng khung giờ" value={completed.length ? `${onTime}/${completed.length}` : "—"} delta="Trên số điểm đã giao" />
      </div>
      <div className="grid-2">
        <RouteMap depot={state.settings.depot} routes={[{ id: r.id, name: r.code, status: r.status, stops: rows.map(({ s, o }) => ({ lat: o.lat, lng: o.lng, seq: s.seq, label: o.address, state: s.completedAt != null ? "done" : s.arrivedAt != null ? "here" : "" })) }]} />
        <section className="panel">
          <div className="panel-head"><h3>Nhật ký tuyến</h3></div>
          <div className="panel-body small stack-sm">
            <div className="row between"><span className="muted">Tạo bởi tối ưu</span><span>{dateTime(r.createdAt)}</span></div>
            <div className="row between"><span className="muted">Chốt tuyến</span><span>{r.lockedAt ? `${dateTime(r.lockedAt)}${r.lockedBy ? `, ${r.lockedBy}` : ""}` : "Chưa chốt"}</span></div>
            <div className="row between"><span className="muted">Xuất kho</span><span>{r.startedAt ? dateTime(r.startedAt) : "Chưa xuất kho"}</span></div>
            <div className="row between"><span className="muted">Bộ giải</span><span>Heuristic chèn tham lam + 2-opt</span></div>
          </div>
        </section>
      </div>
      <section className="panel" style={{ marginTop: 16 }}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>#</th><th>Đơn</th><th>Địa chỉ</th><th>Khách hẹn</th><th>Kế hoạch</th><th>Báo khách</th><th>Thực tế</th><th>Kết quả</th></tr></thead>
            <tbody>
              {rows.map(({ s, o }) => {
                const late = s.arrivedAt != null && s.arrivedAt > toMin(o.window.end);
                return (
                  <tr key={s.seq}>
                    <td><span className={`seq ${s.completedAt != null ? "done" : ""}`}>{s.seq}</span></td>
                    <td><Link href={`/admin/orders/${o.id}`} className="strong" style={{ color: "var(--road)" }}>{o.code}</Link><div className="tiny muted">{o.customerName}</div></td>
                    <td className="small">{o.address}</td>
                    <td className="nowrap">{o.window.start}–{o.window.end}</td>
                    <td>{hm(s.planned)}</td>
                    <td className="nowrap">{hm(s.etaStart)}–{hm(s.etaEnd)}</td>
                    <td style={{ color: late ? "var(--stop)" : undefined }}>{s.arrivedAt != null ? hm(s.arrivedAt) : "—"}{late && <div className="tiny">Trễ hẹn</div>}</td>
                    <td><OrderBadge status={o.status} />{o.failReason && <div className="tiny muted">{o.failReason}</div>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

export default function RouteDetailPage() {
  return <RequirePerm perm="dispatch.view"><RouteDetail /></RequirePerm>;
}
