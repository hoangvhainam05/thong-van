"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { api, loadToken } from "@/lib/api";
import { dateLabel, num, ymd } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import RouteMap, { ROUTE_COLORS } from "@/components/RouteMap";
import Logistics3DSimulation from "@/components/Logistics3DSimulation";
import { Empty, Loading, Modal, OrderBadge, RouteBadge } from "@/components/ui";
import { playSuccess, playTap } from "@/lib/audio-juice";

const REASON = {
  NO_VEHICLE: "Không còn xe trống để nhận đơn này.",
  CAPACITY: "Xe đã hết chỗ chứa. Vui lòng thêm xe, chuyển đơn sang chuyến sau hoặc gia hạn ngày giao hàng.",
  TIME_WINDOW_OR_SHIFT: "Khung giờ hoặc ca giao không phù hợp. Ca sáng và chiều cần tuyến riêng; đơn cả ngày có thể ghép với một trong hai ca.",
};

function deliveryShift(startValue, endValue) {
  const start = String(startValue || "08:00").slice(0, 5);
  const end = String(endValue || "18:00").slice(0, 5);
  if (start >= "12:00") return "Ca chiều";
  if (end <= "12:00") return "Ca sáng";
  return "Cả ngày";
}

function canUseOrderInShift(order, shift) {
  const start = String(order.time_window_start || "08:00").slice(0, 5);
  const end = String(order.time_window_end || "18:00").slice(0, 5);
  return shift === "MORNING" ? start < "12:00" : end > "12:00";
}

function shiftLabel(shift) { return shift === "AFTERNOON" ? "Ca chiều" : "Ca sáng"; }

function DatePickerModal({ value, minDate = ymd(), onClose, onApply }) {
  const [selectedDate, setSelectedDate] = useState(value);
  const [year, month] = selectedDate.split("-").map(Number);
  const [viewMonth, setViewMonth] = useState(() => new Date(year, month - 1, 1));
  const firstDay = (viewMonth.getDay() + 6) % 7;
  const days = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const showToday = () => { const today = new Date(); const earliest = ymd(today) < minDate ? new Date(`${minDate}T00:00:00`) : today; setSelectedDate(ymd(earliest)); setViewMonth(new Date(earliest.getFullYear(), earliest.getMonth(), 1)); };
  return <Modal title="Chọn ngày giao" onClose={onClose} footer={<>
    <button className="btn secondary" onClick={onClose}>Quay lại</button>
    <button className="btn" onClick={() => onApply(selectedDate)}>Áp dụng</button>
  </>}>
    <div className="dispatch-calendar">
      <div className="dispatch-calendar-header">
        <button type="button" className="dispatch-calendar-nav" aria-label="Tháng trước" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}>‹</button>
        <strong>Tháng {viewMonth.getMonth() + 1}, {viewMonth.getFullYear()}</strong>
        <button type="button" className="dispatch-calendar-nav" aria-label="Tháng sau" onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}>›</button>
      </div>
      <div className="dispatch-calendar-grid" aria-label="Lịch chọn ngày">
        {["T2", "T3", "T4", "T5", "T6", "T7", "CN"].map((day) => <span className="dispatch-calendar-weekday" key={day}>{day}</span>)}
        {Array.from({ length: firstDay }, (_, index) => <span key={`blank-${index}`} />)}
        {Array.from({ length: days }, (_, index) => {
          const day = index + 1;
          const dayValue = ymd(new Date(viewMonth.getFullYear(), viewMonth.getMonth(), day));
          return <button key={day} type="button" disabled={dayValue < minDate} className={`dispatch-calendar-day ${dayValue === selectedDate ? "selected" : ""} ${dayValue === ymd() ? "today" : ""}`} aria-label={`${day}/${viewMonth.getMonth() + 1}/${viewMonth.getFullYear()}`} aria-pressed={dayValue === selectedDate} onClick={() => setSelectedDate(dayValue)}>{day}</button>;
        })}
      </div>
      <div className="dispatch-calendar-bottom"><button type="button" className="btn ghost sm" onClick={showToday}>{minDate > ymd() ? "Ngày sớm nhất" : "Hôm nay"}</button><span className="small muted">Đã chọn: {selectedDate.split("-").reverse().join("/")}</span></div>
    </div>
  </Modal>;
}

function Dispatch() {
  const { can } = useStore();
  const [date, setDate] = useState(ymd());
  const [shift, setShift] = useState("MORNING");
  const [token, setToken] = useState("");
  const [orders, setOrders] = useState([]);
  const [failedOrders, setFailedOrders] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [warehouse, setWarehouse] = useState(null);
  const [selectedVehicles, setSelectedVehicles] = useState([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cancelRoute, setCancelRoute] = useState(null);
  const [assignment, setAssignment] = useState(null);
  const [error, setError] = useState("");
  const [view3D, setView3D] = useState(false);
  const [mapRouteId, setMapRouteId] = useState(null);
  const [mapChoice, setMapChoice] = useState(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState(null);

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
      setMapRouteId((current) => current === "all" || nextRoutes.some((route) => route.id === current) ? current : (nextRoutes[0]?.id ?? null));
      setDrivers(nextDrivers);
      setVehicles(nextVehicles);
      setWarehouse(nextWarehouse);
      const readyIds = new Set(nextOrders.filter((order) => order.status === "READY" && canUseOrderInShift(order, shift)).map((order) => order.id));
      setSelectedOrderIds((current) => current.filter((id) => readyIds.has(id)));
      const used = new Set(nextRoutes.filter((route) => route.shift === shift).map((route) => route.vehicle_id));
      const freeIds = nextVehicles.filter((vehicle) => vehicle.active && !used.has(vehicle.id)).map((vehicle) => vehicle.id);
      setSelectedVehicles((current) => current.length ? current.filter((id) => freeIds.includes(id)) : freeIds);
    } catch (err) {
      setError(err.message || "Không tải được dữ liệu điều phối.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (token) refresh(token); }, [date, shift, token]);

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
  const usedVehicles = new Set(routes.filter((route) => route.shift === shift).map((route) => route.vehicle_id));
  const eligibleReady = ready.filter((order) => canUseOrderInShift(order, shift));
  const shiftOrders = eligibleReady;
  const mapRoutes = routes.map((route, index) => ({
    color: ROUTE_COLORS[index % ROUTE_COLORS.length], id: route.id, name: `${route.vehicle} · ${shiftLabel(route.shift)} · ${route.code}`, status: route.status, depot: route.depot,
    stops: route.stops.map((stop) => ({ lat: stop.lat, lng: stop.lng, seq: stop.sequence, label: stop.address })),
  }));
  const visibleMapRoutes = mapRouteId === "all" ? mapRoutes : mapRoutes.filter((route) => route.id === mapRouteId);
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

  function selectShift(value) {
    if (value === shift) return;
    setShift(value);
    setResult(null);
    setSelectedOrderIds([]);
  }

  return (
    <>
      <PageHead title="Điều phối giao hàng" sub="Xếp các đơn đã chuẩn bị hàng vào tuyến giao, kiểm tra sức chứa và chốt lịch.">
        <div className="dispatch-assignment"><span className="small">Ngày giao</span><button type="button" className="dispatch-assignment-button" onClick={() => setDatePickerOpen(true)}><span>{date.split("-").reverse().join("/")}</span><span aria-hidden="true">▦</span></button></div>
      </PageHead>

      {error && <div className="notice bad" style={{ marginBottom: 14 }}>{error}</div>}
      {loading && <Loading />}

      {token && !loading && failedOrders.length > 0 && <section className="panel panel-pad stack-sm" style={{marginBottom:16}}>
        <h3>Đơn giao thất bại cần hẹn lại</h3>
        <p className="small muted">Chọn ngày giao mới ở đầu trang, sau đó đưa đơn vào hàng đợi ngày đó.</p>
        {failedOrders.map(order => <div key={order.id} className="row between small"><span><b>{order.code}</b> · ngày giao cũ {dateLabel(order.delivery_date)} · {order.address}</span><button className="btn secondary sm" disabled={busy || !can('route.optimize') || date <= order.delivery_date || date < ymd()} onClick={() => perform(() => api(`/api/orders/${order.id}/reschedule`, {method:'POST',token,body:{delivery_date:date}}))}>Hẹn lại {dateLabel(date)}</button></div>)}
      </section>}

      {datePickerOpen && <DatePickerModal
        value={rescheduleTarget ? (() => { const next = new Date(`${date}T00:00:00`); next.setDate(next.getDate() + 1); return ymd(next); })() : date}
        minDate={rescheduleTarget ? (() => { const next = new Date(`${date}T00:00:00`); next.setDate(next.getDate() + 1); return ymd(next); })() : ymd()}
        onClose={() => { setDatePickerOpen(false); setRescheduleTarget(null); }}
        onApply={(nextDate) => {
          setDatePickerOpen(false);
          if (rescheduleTarget) {
            const orderId = rescheduleTarget;
            setRescheduleTarget(null);
            perform(async () => {
              await api(`/api/orders/${orderId}/reschedule`, { method: "POST", token, body: { delivery_date: nextDate } });
              setResult(null);
            });
          } else {
            setDate(nextDate); setResult(null); setMapRouteId(null); setSelectedOrderIds([]);
          }
        }}
      />}
      {mapChoice !== null && <Modal title="Chọn tuyến trên bản đồ" onClose={() => setMapChoice(null)} footer={<>
        <button className="btn secondary" onClick={() => setMapChoice(null)}>Quay lại</button>
        <button className="btn" onClick={() => { setMapRouteId(mapChoice); setMapChoice(null); }}>Xem tuyến</button>
      </>}>
        <p className="small muted" style={{ marginBottom: 14 }}>Chọn tuyến của xe để xem đường đi và các điểm giao.</p>
        <div className="dispatch-options" role="radiogroup" aria-label="Tuyến trên bản đồ">
          {routes.map((route, index) => <label className={`dispatch-option ${mapChoice === route.id ? "selected" : ""}`} key={route.id}>
            <input type="radio" name="map-route-choice" checked={mapChoice === route.id} onChange={() => setMapChoice(route.id)} />
            <span><b>{route.vehicle}</b><small>{shiftLabel(route.shift)} · {route.code} · {route.stops.length} điểm giao</small></span>
            <i className="map-legend-line" style={{ borderColor: ROUTE_COLORS[index % ROUTE_COLORS.length] }} />
          </label>)}
          <label className={`dispatch-option ${mapChoice === "all" ? "selected" : ""}`}>
            <input type="radio" name="map-route-choice" checked={mapChoice === "all"} onChange={() => setMapChoice("all")} />
            <span><b>Tất cả tuyến</b><small>Hiển thị tổng quan các xe</small></span>
          </label>
        </div>
      </Modal>}

      {cancelRoute && <Modal title="Hủy tuyến nháp" onClose={() => { if (!busy) setCancelRoute(null); }} footer={<>
        <button className="btn secondary" disabled={busy} onClick={() => setCancelRoute(null)}>Quay lại</button>
        <button className="btn danger" disabled={busy} onClick={() => perform(async () => {
          await api("/api/routes/" + cancelRoute.id + "/cancel", { method: "POST", token });
          setResult(null);
          setCancelRoute(null);
        })}>{busy ? "Đang hủy…" : "Xác nhận hủy tuyến"}</button>
      </>}>
        <p>Bạn muốn hủy tuyến <b>{cancelRoute.code}</b> của xe <b>{cancelRoute.vehicle}</b>? Các đơn sẽ trở lại hàng đợi để bố trí lại.</p>
        {error && <div className="notice bad" style={{ marginTop: 12 }}>{error}</div>}
      </Modal>}

      {assignment && <Modal title={assignment.kind === "vehicle" ? "Chọn xe giao hàng" : "Chọn tài xế"} onClose={() => { if (!busy) setAssignment(null); }} footer={<>
        <button className="btn secondary" disabled={busy} onClick={() => setAssignment(null)}>Quay lại</button>
        <button className="btn" disabled={busy || (assignment.kind === "vehicle" && assignment.value == null)} onClick={() => perform(async () => {
          await api(`/api/routes/${assignment.route.id}/draft`, { method: "PATCH", token, body: assignment.kind === "vehicle" ? { vehicle_id: assignment.value } : { driver_id: assignment.value } });
          setAssignment(null);
        })}>{busy ? "Đang lưu…" : "Xác nhận"}</button>
      </>}>
        <p className="small muted" style={{ marginBottom: 14 }}>Tuyến {assignment.route.code} · Chọn một {assignment.kind === "vehicle" ? "xe" : "tài xế"} cho tuyến này.</p>
        <div className="dispatch-options" role="radiogroup" aria-label={assignment.kind === "vehicle" ? "Xe giao hàng" : "Tài xế"}>
          {assignment.kind === "driver" && <label className={`dispatch-option ${assignment.value == null ? "selected" : ""}`}>
            <input type="radio" name="dispatch-assignment" checked={assignment.value == null} disabled={busy} onChange={() => setAssignment({ ...assignment, value: null })} />
            <span><b>Chưa phân công</b><small>Bỏ chọn tài xế hiện tại</small></span>
          </label>}
          {(assignment.kind === "vehicle" ? vehicles : drivers).filter((item) => item.active || item.id === (assignment.kind === "vehicle" ? assignment.route.vehicle_id : assignment.route.driver_id)).map((item) => {
            const assigned = routes.find((other) => other.id !== assignment.route.id && other.shift === assignment.route.shift && (assignment.kind === "vehicle" ? other.vehicle_id : other.driver_id) === item.id);
            return <label className={`dispatch-option ${assignment.value === item.id ? "selected" : ""} ${assigned || !item.active ? "unavailable" : ""}`} key={item.id}>
              <input type="radio" name="dispatch-assignment" checked={assignment.value === item.id} disabled={busy || Boolean(assigned) || !item.active} onChange={() => setAssignment({ ...assignment, value: item.id })} />
              <span><b>{assignment.kind === "vehicle" ? item.plate : item.name}</b><small>{assigned ? `Đã có tuyến ${assigned.code}` : !item.active ? "Không hoạt động" : assignment.kind === "vehicle" ? `${item.capacity_m3} m³ · ${item.capacity_kg} kg` : "Sẵn sàng phân công"}</small></span>
              {assignment.value === item.id && <span className="dispatch-option-current">Đang chọn</span>}
            </label>;
          })}
        </div>
        {error && <div className="notice bad" style={{ marginTop: 12 }}>{error}</div>}
      </Modal>}

      {token && !loading && <>
        <div className="grid-2" style={{ marginBottom: 16 }}>
          <section className="panel panel-pad stack-sm">
            <h3>Hàng đợi {dateLabel(date)}</h3>
            <div className="small">{eligibleReady.length} đơn phù hợp {shiftLabel(shift).toLowerCase()} · {missing.filter((order) => canUseOrderInShift(order, shift)).length} thiếu vị trí · {waiting.length} đang xác nhận</div>
            <div className="dispatch-queue-filters" role="group" aria-label="Lọc hàng đợi theo ca">
              <button type="button" className={`btn sm ${shift === "MORNING" ? "" : "secondary"}`} aria-pressed={shift === "MORNING"} disabled={busy} onClick={() => selectShift("MORNING")}>Ca sáng <span>(sáng + cả ngày)</span></button>
              <button type="button" className={`btn sm ${shift === "AFTERNOON" ? "" : "secondary"}`} aria-pressed={shift === "AFTERNOON"} disabled={busy} onClick={() => selectShift("AFTERNOON")}>Ca chiều <span>(chiều + cả ngày)</span></button>
            </div>
            {eligibleReady.length > 0 && <label className="check dispatch-select-all" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={selectedOrderIds.length === eligibleReady.length} onChange={(event) => setSelectedOrderIds(event.target.checked ? eligibleReady.map((order) => order.id) : [])} />
              Chọn tất cả đơn phù hợp ca
            </label>}
            {ready.length === 0 && <Empty title="Chưa có đơn sẵn sàng" />}
            {ready.length > 0 && shiftOrders.length === 0 && <Empty title={`Không có đơn phù hợp ${shiftLabel(shift).toLowerCase()}`} />}
            {shiftOrders.length > 0 && <div className="dispatch-order-list" aria-label={`Danh sách đơn phù hợp ${shiftLabel(shift).toLowerCase()}`}>
            {shiftOrders.map((order) => <div key={order.id} className={`dispatch-order-row small ${selectedOrderIds.includes(order.id) ? "selected" : ""}`}>
              <div className="dispatch-order-main">
                <input type="checkbox" aria-label={`Chọn đơn ${order.code} để bố trí điểm giao`} checked={selectedOrderIds.includes(order.id)} onChange={(event) => setSelectedOrderIds((current) => event.target.checked ? [...current, order.id] : current.filter((id) => id !== order.id))} />
                <div className="dispatch-order-copy"><div className="dispatch-order-title"><Link href={"/admin/orders/" + order.id} className="strong">{order.code}</Link> {order.is_urgent && <span className="badge move">Gấp</span>} <span className="badge">{deliveryShift(order.time_window_start, order.time_window_end)}</span> <span className="tiny muted">{String(order.time_window_start).slice(0, 5)}–{String(order.time_window_end).slice(0, 5)}</span></div>
                  <div className="tiny muted dispatch-order-address" title={order.address}>{order.address}</div>
                  <div className="tiny dispatch-order-products">{(order.items || []).map((item) => `${item.product_name || item.name} × ${item.quantity}`).join(", ") || "Chưa có thông tin sản phẩm"} · {Number(order.volume_m3 || 0).toFixed(3)} m³</div>
                </div>
              </div>
              <div className="dispatch-order-actions">
                {order.lat == null && <span className="badge move">Thiếu vị trí</span>}
                {can("route.dispatch") && <button className="btn ghost sm" disabled={busy} onClick={() => perform(() => api("/api/orders/" + order.id + "/priority", { method: "PATCH", token, body: { is_urgent: !order.is_urgent } }))}>{order.is_urgent ? "Bỏ gấp" : "Đánh dấu gấp"}</button>}
              </div>
            </div>)}
            </div>}
            {waiting.length > 0 && <p className="tiny muted">Đơn đang xác nhận cần được chuyển sang “Sẵn sàng” tại <Link href="/admin/orders">Quản lý đơn</Link>.</p>}
            {missing.length > 0 && <p className="tiny muted">Đơn thiếu vị trí cần được cập nhật toạ độ trong chi tiết đơn trước khi xếp tuyến.</p>}
          </section>

          <section className="panel panel-pad stack">
            <h3>Chạy tối ưu</h3>
            <p className="small muted">Chọn ca trước, sau đó chọn đơn và xe. Đơn chỉ giao được trong ca này được xếp trước; đơn cả ngày lấp chỗ còn trống, nếu chưa xếp được vẫn ở hàng đợi để thử ở ca tiếp theo.</p>
            <fieldset className="dispatch-shift-picker" aria-label="Chọn ca bố trí">
              <legend className="small">Ca cần bố trí</legend>
              {[["MORNING", "Ca sáng", "08:00–12:00"], ["AFTERNOON", "Ca chiều", "12:00–18:00"]].map(([value, label, hours]) => <label className={`dispatch-option ${shift === value ? "selected" : ""}`} key={value}>
                <input type="radio" name="dispatch-shift" value={value} checked={shift === value} disabled={busy} onChange={() => selectShift(value)} />
                <span><b>{label}</b><small>{hours}</small></span>
              </label>)}
            </fieldset>
            {vehicles.filter((vehicle) => vehicle.active).map((vehicle) => <label className="check" key={vehicle.id}>
              <input type="checkbox" checked={selectedVehicles.includes(vehicle.id)} disabled={usedVehicles.has(vehicle.id)} onChange={(event) => setSelectedVehicles(event.target.checked ? [...selectedVehicles, vehicle.id] : selectedVehicles.filter((id) => id !== vehicle.id))} />
              {vehicle.plate} <span className="muted small">· {vehicle.capacity_m3} m³ · {vehicle.capacity_kg} kg {usedVehicles.has(vehicle.id) ? `· đã có tuyến ${shiftLabel(shift).toLowerCase()}` : ""}</span>
            </label>)}
            <p className="tiny muted">Ràng buộc: khung giờ khách, thể tích, tải trọng kg, thời gian dỡ/lắp và giờ kết thúc ca. Một xe có thể nhận một tuyến sáng và một tuyến chiều.</p>
            <p className="tiny muted">{selectedOrderIds.length ? `Đã chọn ${selectedOrderIds.length} đơn.` : "Chọn ít nhất một đơn để bố trí."}</p>
            {can("route.optimize") && <button className="btn lg" disabled={busy || !selectedVehicles.length || !selectedOrderIds.length} onClick={() => perform(async () => {
              const next = await api("/api/routes/optimize", { method: "POST", token, body: { date, shift, vehicle_ids: selectedVehicles, order_ids: selectedOrderIds } });
              setResult(next);
              playSuccess();
            })}>{busy ? "Đang xử lý…" : "Bố trí điểm giao"}</button>}
            {result && <div className={`notice ${result.unassigned?.length ? "warn" : "ok"} stack-sm small`}>
              <b>{result.routes.length} tuyến · {result.total_km} km · tiết kiệm {result.saving_percent ?? "—"}%</b>
              <span>{result.distance_source === "ors" ? "Số liệu định tuyến OpenRouteService" : "Số liệu khoảng cách và thời gian là ước tính"}</span>
              {result.unassigned?.map((item) => <div key={item.order_id}><b>{item.code}:</b> {item.defer_to_shift ? "Chưa xếp được ca sáng; đơn cả ngày vẫn ở hàng đợi. Chọn ca chiều để xếp tiếp." : REASON[item.reason] || item.reason} {!item.defer_to_shift && (item.reason === "CAPACITY" || item.reason === "NO_VEHICLE") ? <span>Hãy chọn thêm xe ở trên hoặc </span> : null}{!item.defer_to_shift && (item.reason === "CAPACITY" || item.reason === "NO_VEHICLE") && <button className="btn ghost sm" disabled={busy} onClick={() => { setRescheduleTarget(item.order_id); setDatePickerOpen(true); }}>đổi ngày giao</button>}</div>)}
              {result.missing_location_codes?.map((code) => <div key={code}>{code}: Thiếu vị trí</div>)}
            </div>}
          </section>
        </div>

        <div className="row between" style={{ margin: "18px 0 10px" }}>
          <div className="strong" style={{ fontSize: 16 }}>Bản đồ trực quan mạng lưới điều phối</div>
          <div className="hud-pill-group">
            <button
              type="button"
              className={`hud-pill ${!view3D ? "on" : ""}`}
              onClick={() => { setView3D(false); playTap(700); }}
            >
              🗺️ Bản đồ 2D (Leaflet)
            </button>
            <button
              type="button"
              className={`hud-pill ${view3D ? "on" : ""}`}
              onClick={() => { setView3D(true); playTap(900); }}
            >
              🌐 Sa bàn 3D (Simulation)
            </button>
          </div>
        </div>

        {!view3D && routes.length > 0 && <div className="row" style={{ marginBottom: 12 }}>
          <div className="dispatch-assignment"><span className="small">Xem tuyến của xe</span>
            <button type="button" className="dispatch-assignment-button" onClick={() => setMapChoice(mapRouteId ?? routes[0].id)}><span>{mapRouteId === "all" ? "Tất cả tuyến" : (mapRoutes.find((route) => route.id === mapRouteId)?.name || "Chọn tuyến")}</span><span aria-hidden="true">✎</span></button>
          </div>
        </div>}
        {view3D ? (
          <Logistics3DSimulation height={440} showControls={true} />
        ) : (
          warehouse && <RouteMap depot={warehouse} routes={visibleMapRoutes} loose={mapRouteId === "all" || !routes.length ? loose : []} height={360} />
        )}
        <div className="stack" style={{ marginTop: 16 }}>
          {routes.length === 0 && <div className="panel"><Empty title="Chưa có tuyến cho ngày này">Chọn xe và chạy tối ưu khi có đơn sẵn sàng.</Empty></div>}
          {routes.map((route) => <section className="panel" key={route.id}>
            <div className="panel-head row between"><div className="row"><b>{route.code}</b><span className="badge">{shiftLabel(route.shift)}</span><RouteBadge status={route.status} /><span className="small muted">{route.total_km} km {route.distance_source === "estimate" ? "(ước tính)" : "(ORS)"} · {num(route.total_minutes / 60, 1)} giờ · {num(route.total_volume_m3, 3)} m³ / {num(route.vehicle_capacity_m3, 3)} m³ · {num(route.total_weight_kg, 1)} / {num(route.vehicle_capacity_kg, 0)} kg</span></div><div className="row"><Link className="btn ghost sm" href={"/admin/routes/" + route.id}>Chi tiết</Link>{can("route.optimize") && route.status === "DRAFT" && <button className="btn secondary sm" disabled={busy} onClick={() => { setError(""); setCancelRoute(route); }}>Hủy tuyến</button>}{can("route.approve") && route.status === "DRAFT" && <button className="btn sm" disabled={busy || !route.driver_id} onClick={() => perform(() => api("/api/routes/" + route.id + "/lock", { method: "POST", token }))}>Duyệt và chốt</button>}</div></div>
            <div className="panel-body stack-sm">
              <div className="dispatch-assignments">
                <div className="dispatch-assignment"><span className="tiny muted">Xe giao hàng</span><button type="button" className="dispatch-assignment-button" disabled={busy || route.status !== "DRAFT" || !can("route.dispatch")} onClick={() => { setError(""); setAssignment({ kind: "vehicle", route, value: route.vehicle_id }); }}><span>{route.vehicle}</span><span aria-hidden="true">✎</span></button></div>
                <div className="dispatch-assignment"><span className="tiny muted">Tài xế</span><button type="button" className="dispatch-assignment-button" disabled={busy || route.status !== "DRAFT" || !can("route.dispatch")} onClick={() => { setError(""); setAssignment({ kind: "driver", route, value: route.driver_id }); }}><span>{route.driver_name || "Chọn tài xế"}</span><span aria-hidden="true">✎</span></button></div>
              </div>
              <ol className="stop-list">
                {route.stops.map((stop, index) => <li key={stop.stop_id}>
                  <span className="seq">{stop.sequence}</span>
                  <div className="grow"><Link href={"/admin/orders/" + stop.order_id} className="strong">{stop.order_code}</Link> {stop.is_urgent && <span className="badge move">Gấp</span>} <span className="badge">{deliveryShift(stop.time_window?.split("–")[0], stop.time_window?.split("–")[1])}</span> · {stop.customer_name}<div className="tiny muted">{stop.address} · hẹn {stop.time_window}</div><div className="tiny" style={{ marginTop: 3 }}>{(stop.items || []).map((item) => `${item.name} × ${item.quantity} (${Number(item.volume_m3 || 0).toFixed(3)} m³)`).join(", ")} · Tổng {Number(stop.volume_m3 || 0).toFixed(3)} m³</div></div>
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
