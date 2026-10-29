"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, loadToken } from "@/lib/api";
import { dateLabel, num, ymd } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import RouteMap from "@/components/RouteMap";
import { Empty, Loading, OrderBadge, RouteBadge } from "@/components/ui";

const REASON = {
  NO_VEHICLE: "Không còn xe trống",
  CAPACITY: "Vượt thể tích hoặc tải trọng xe",
  TIME_WINDOW_OR_SHIFT: "Không phù hợp khung giờ hoặc ca 8 giờ",
};

function Dispatch() {
  const { can } = useStore();
  const [date, setDate] = useState(ymd());
  const [token, setToken] = useState("");
  const [orders, setOrders] = useState([]);
  const [failedOrders, setFailedOrders] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [warehouse, setWarehouse] = useState(null);
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setToken(loadToken()); }, []);

  async function refresh(credential = token) {
    if (!credential) return;
    setLoading(true);
    setError("");
    try {
      const [nextOrders, nextRoutes, nextDrivers, nextVehicles, nextWarehouse, nextFailed] = await Promise.all([
        api("/api/orders?delivery_date=" + encodeURIComponent(date), { token: credential }),
        api("/api/routes?route_date=" + encodeURIComponent(date), { token: credential }),
        api("/api/drivers", { token: credential }),
        api("/api/vehicles", { token: credential }),
        api("/api/warehouse", { token: credential }),
        api("/api/orders?status=FAILED", { token: credential }),
      ]);
      setOrders(nextOrders);
      setFailedOrders(nextFailed);
      setRoutes(nextRoutes);
      setDrivers(nextDrivers);
      setVehicles(nextVehicles);
      setWarehouse(nextWarehouse);
      const used = new Set(nextRoutes.filter((route) => route.status !== "DRAFT").map((route) => route.vehicle_id));
      const freeIds = nextVehicles.filter((vehicle) => vehicle.active && !used.has(vehicle.id)).map((vehicle) => vehicle.id);
      setSelected((current) => current.length ? current.filter((id) => freeIds.includes(id)) : freeIds);
    } catch (err) {
      setError(err.message || "Không tải được dữ liệu điều phối.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (token) refresh(token); }, [date, token]);

  async function perform(callback) {
    setBusy(true);
    setError("");
    try {
      await callback();
      await refresh();
    } catch (err) {
      setError(err.message || "Thao tác chưa hoàn tất.");
    } finally {
      setBusy(false);
    }
  }

  const ready = orders.filter((order) => order.status === "READY");
  const missing = ready.filter((order) => order.lat == null || order.lng == null);
  const located = ready.filter((order) => order.lat != null && order.lng != null);
  const waiting = orders.filter((order) => ["PENDING", "CONFIRMED"].includes(order.status));
  const usedVehicles = new Set(routes.filter((route) => route.status !== "DRAFT").map((route) => route.vehicle_id));
  const mapRoutes = routes.map((route) => ({
    id: route.id, name: route.code, status: route.status, depot: route.depot,
    stops: route.stops.map((stop) => ({ lat: stop.lat, lng: stop.lng, seq: stop.sequence, label: stop.address })),
  }));
  const loose = located.map((order) => ({ lat: order.lat, lng: order.lng, label: order.code }));

  function changeOrder(route, index, direction) {
    const ids = route.stops.map((stop) => stop.order_id);
    const other = index + direction;
    if (other < 0 || other >= ids.length) return;
    [ids[index], ids[other]] = [ids[other], ids[index]];
    perform(() => api("/api/routes/" + route.id + "/draft", {
      method: "PATCH", token, body: { order_ids: ids },
    }));
  }

  return (
    <>
      <PageHead title="Điều phối giao hàng" sub="Xếp các đơn đã chuẩn bị hàng vào tuyến giao, kiểm tra sức chứa và chốt lịch.">
        <label className="small">Ngày giao <input className="input" type="date" value={date} onChange={(event) => { setDate(event.target.value); setResult(null); }} /></label>
      </PageHead>

      {error && <div className="notice bad" style={{ marginBottom: 14 }}>{error}</div>}
      {loading && <Loading />}

      {token && !loading && failedOrders.length > 0 && <section className="panel panel-pad stack-sm" style={{marginBottom:16}}>
        <h3>Đơn giao thất bại cần hẹn lại</h3>
        <p className="small muted">Chọn ngày giao mới ở đầu trang, sau đó đưa đơn vào hàng đợi ngày đó.</p>
        {failedOrders.map(order => <div key={order.id} className="row between small"><span><b>{order.code}</b> · ngày giao cũ {dateLabel(order.delivery_date)} · {order.address}</span><button className="btn secondary sm" disabled={busy || !can('route.optimize') || date <= order.delivery_date || date < ymd()} onClick={() => perform(() => api(`/api/orders/${order.id}/reschedule`, {method:'POST',token,body:{delivery_date:date}}))}>Hẹn lại {dateLabel(date)}</button></div>)}
      </section>}

      {token && !loading && <>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <section className="panel panel-pad stack-sm">
            <h3>Hàng đợi {dateLabel(date)}</h3>
            <div className="small">{ready.length} đơn sẵn sàng · {missing.length} thiếu vị trí · {waiting.length} đang xác nhận</div>
            {ready.length === 0 && <Empty title="Chưa có đơn sẵn sàng" />}
            {ready.map((order) => <div key={order.id} className="row between small" style={{ borderBottom: "1px solid var(--line-soft)", padding: "6px 0" }}>
              <div><Link href={"/admin/orders/" + order.id} className="strong">{order.code}</Link> {order.is_urgent && <span className="badge move">Gấp</span>}<div className="tiny muted">{order.address} · {String(order.time_window_start).slice(0, 5)}–{String(order.time_window_end).slice(0, 5)}</div></div>
              <div className="row">
                {order.lat == null && <span className="badge move">Thiếu vị trí</span>}
                {can("route.dispatch") && <button className="btn ghost sm" disabled={busy} onClick={() => perform(() => api("/api/orders/" + order.id + "/priority", { method: "PATCH", token, body: { is_urgent: !order.is_urgent } }))}>{order.is_urgent ? "Bỏ gấp" : "Đánh dấu gấp"}</button>}
              </div>
            </div>)}
            {waiting.length > 0 && <p className="tiny muted">Đơn đang xác nhận cần được chuyển sang “Sẵn sàng” tại <Link href="/admin/orders">Quản lý đơn</Link>.</p>}
            {missing.length > 0 && <p className="tiny muted">Đơn thiếu vị trí cần được cập nhật toạ độ trong chi tiết đơn trước khi xếp tuyến.</p>}
          </section>

          <section className="panel panel-pad stack">
            <h3>Chạy tối ưu</h3>
            <p className="small muted">Chọn xe tham gia. Tuyến đã chốt và xe/tài xế của tuyến đó được giữ nguyên. Đơn gấp được ưu tiên khi xếp.</p>
            {vehicles.filter((vehicle) => vehicle.active).map((vehicle) => <label className="check" key={vehicle.id}>
              <input type="checkbox" checked={selected.includes(vehicle.id)} disabled={usedVehicles.has(vehicle.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, vehicle.id] : selected.filter((id) => id !== vehicle.id))} />
              {vehicle.plate} <span className="muted small">· {vehicle.capacity_m3} m³ · {vehicle.capacity_kg} kg {usedVehicles.has(vehicle.id) ? "· đã có tuyến chốt" : ""}</span>
            </label>)}
            <p className="tiny muted">Ràng buộc: khung giờ khách, thể tích, tải trọng kg, thời gian dỡ/lắp và ca tối đa 8 giờ. Bộ giải hiện dùng heuristic nội bộ.</p>
            {can("route.optimize") && <button className="btn lg" disabled={busy || !selected.length || !located.length} onClick={() => perform(async () => {
              const next = await api("/api/routes/optimize", { method: "POST", token, body: { date, vehicle_ids: selected } });
              setResult(next);
            })}>{busy ? "Đang xử lý…" : "Tối ưu tuyến nháp"}</button>}
            {result && <div className="notice ok stack-sm small">
              <b>{result.routes.length} tuyến · {result.total_km} km · tiết kiệm {result.saving_percent ?? "—"}%</b>
              <span>{result.distance_source === "ors" ? "Số liệu định tuyến OpenRouteService" : "Số liệu khoảng cách và thời gian là ước tính"}</span>
              {result.unassigned?.map((item) => <div key={item.order_id}>{item.code}: {REASON[item.reason] || item.reason}</div>)}
              {result.missing_location_codes?.map((code) => <div key={code}>{code}: Thiếu vị trí</div>)}
            </div>}
          </section>
        </div>

        {warehouse && <RouteMap depot={warehouse} routes={mapRoutes} loose={loose} height={360} />}
        <div className="stack" style={{ marginTop: 16 }}>
          {routes.length === 0 && <div className="panel"><Empty title="Chưa có tuyến cho ngày này">Chọn xe và chạy tối ưu khi có đơn sẵn sàng.</Empty></div>}
          {routes.map((route) => <section className="panel" key={route.id}>
            <div className="panel-head row between"><div className="row"><b>{route.code}</b><RouteBadge status={route.status} /><span className="small muted">{route.total_km} km {route.distance_source === "estimate" ? "(ước tính)" : "(ORS)"} · {num(route.total_minutes / 60, 1)} giờ / 8 giờ</span></div><div className="row"><Link className="btn ghost sm" href={"/admin/routes/" + route.id}>Chi tiết</Link>{can("route.approve") && route.status === "DRAFT" && <button className="btn sm" disabled={busy || !route.driver_id} onClick={() => perform(() => api("/api/routes/" + route.id + "/lock", { method: "POST", token }))}>Duyệt và chốt</button>}</div></div>
            <div className="panel-body stack-sm">
              <div className="row">
                <label className="small">Xe <select className="input" value={route.vehicle_id} disabled={busy || route.status !== "DRAFT" || !can("route.dispatch")} onChange={(event) => perform(() => api("/api/routes/" + route.id + "/draft", { method: "PATCH", token, body: { vehicle_id: Number(event.target.value) } }))}>{vehicles.filter((vehicle) => vehicle.active || vehicle.id === route.vehicle_id).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate} · {vehicle.capacity_m3} m³ / {vehicle.capacity_kg} kg</option>)}</select></label>
                <label className="small">Tài xế <select className="input" value={route.driver_id || ""} disabled={busy || route.status !== "DRAFT" || !can("route.dispatch")} onChange={(event) => perform(() => api("/api/routes/" + route.id + "/draft", { method: "PATCH", token, body: { driver_id: event.target.value ? Number(event.target.value) : null } }))}><option value="">Chọn tài xế</option>{drivers.filter((driver) => driver.active || driver.id === route.driver_id).map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}</select></label>
              </div>
              <ol className="stop-list">
                {route.stops.map((stop, index) => <li key={stop.stop_id}>
                  <span className="seq">{stop.sequence}</span>
                  <div className="grow"><Link href={"/admin/orders/" + stop.order_id} className="strong">{stop.order_code}</Link> {stop.is_urgent && <span className="badge move">Gấp</span>} · {stop.customer_name}<div className="tiny muted">{stop.address} · hẹn {stop.time_window}</div></div>
                  <div className="right small">{new Date(stop.planned_arrival).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}</div>
                  {route.status === "DRAFT" && can("route.dispatch") && <div className="row"><button className="btn ghost sm" disabled={busy || index === 0} onClick={() => changeOrder(route, index, -1)} aria-label="Đưa điểm lên">↑</button><button className="btn ghost sm" disabled={busy || index === route.stops.length - 1} onClick={() => changeOrder(route, index, 1)} aria-label="Đưa điểm xuống">↓</button></div>}
                </li>)}
              </ol>
              {route.status === "DRAFT" && !route.driver_id && <p className="small muted">Chọn tài xế trước khi chốt tuyến.</p>}
            </div>
          </section>)}
        </div>
      </>}
    </>
  );
}

export default function DispatchPage() {
  return <RequirePerm perm="dispatch.view"><Dispatch /></RequirePerm>;
}
