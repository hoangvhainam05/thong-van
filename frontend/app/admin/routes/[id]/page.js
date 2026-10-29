"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api, loadToken } from "@/lib/api";
import { dateLabel, num } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import RouteMap from "@/components/RouteMap";
import { Empty, Loading, RouteBadge } from "@/components/ui";

function RouteDetail() {
  const { id } = useParams();
  const [route, setRoute] = useState(null);
  const [warehouse, setWarehouse] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = loadToken();
    if (!token) {
      setError("Vui lòng đăng nhập để xem tuyến.");
      setLoading(false);
      return;
    }
    Promise.all([
      api("/api/routes/" + id, { token }),
      api("/api/warehouse", { token }),
    ]).then(([loadedRoute, loadedWarehouse]) => {
      setRoute(loadedRoute);
      setWarehouse(loadedWarehouse);
    }).catch((err) => setError(err.message || "Không tải được tuyến."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Loading />;
  if (error) return <div className="panel"><Empty title="Không tải được tuyến">{error} <Link href="/admin/dispatch">Về điều phối</Link></Empty></div>;
  if (!route) return <div className="panel"><Empty title="Không tìm thấy tuyến" /></div>;

  const saving = route.baseline_km > 0 ? Math.round((route.baseline_km - route.total_km) / route.baseline_km * 100) : null;
  const points = route.stops.map((stop) => ({
    lat: stop.lat, lng: stop.lng, seq: stop.sequence, label: stop.address,
  }));
  return <>
    <Link href="/admin/dispatch" className="small muted">‹ Điều phối giao hàng</Link>
    <PageHead title={"Tuyến " + route.code} sub={"Giao " + dateLabel(route.route_date) + " · " + route.vehicle + " · " + (route.driver_name || "chưa phân công")}>
      <RouteBadge status={route.status} />
    </PageHead>
    <div className="kpis" style={{ marginBottom: 16 }}>
      <div className="kpi"><div className="label">Điểm giao</div><div className="value">{route.stops.length}</div></div>
      <div className="kpi"><div className="label">Quãng đường</div><div className="value">{route.total_km} km</div><div className="tiny muted">{route.distance_source === "estimate" ? "Số liệu ước tính" : "Định tuyến OpenRouteService"} · Thứ tự đặt hàng: {route.baseline_km ?? "—"} km{saving != null ? " · tiết kiệm " + saving + "%" : ""}</div></div>
      <div className="kpi"><div className="label">Thời gian</div><div className="value">{num(route.total_minutes / 60, 1)} giờ</div><div className="tiny muted">Ca tối đa 8 giờ</div></div>
    </div>
    {warehouse && <RouteMap depot={route.depot || warehouse} routes={[{ id: route.id, name: route.code, status: route.status, stops: points }]} height={330} />}
    <section className="panel" style={{ marginTop: 16 }}>
      <div className="panel-head"><h3>Thứ tự giao đã lưu trong MySQL</h3></div>
      <div className="table-wrap"><table className="table">
        <thead><tr><th>#</th><th>Đơn</th><th>Địa chỉ</th><th>Khung giờ</th><th>Đến dự kiến</th><th>Trạng thái</th></tr></thead>
        <tbody>{route.stops.map((stop) => <tr key={stop.stop_id}>
          <td>{stop.sequence}</td>
          <td><b>{stop.order_code}</b><div className="tiny muted">{stop.customer_name}</div></td>
          <td>{stop.address}</td>
          <td>{stop.time_window}</td>
          <td>{new Date(stop.planned_arrival).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</td>
          <td>{stop.order_status}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </>;
}

export default function RouteDetailPage() {
  return <RequirePerm perm="dispatch.view"><RouteDetail /></RequirePerm>;
}
