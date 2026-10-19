"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ROUTE_STATUS, useStore } from "@/lib/store";
import { addDays, dateLabel, hm, num, ymd } from "@/lib/format";
import { Can, RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import RouteMap, { ROUTE_COLORS } from "@/components/RouteMap";
import { Empty, RouteBadge, Seg } from "@/components/ui";

function Dispatch() {
  const { state, can, actions } = useStore();
  const today = ymd();
  const [date, setDate] = useState(today);
  const [picked, setPicked] = useState(null);
  const [result, setResult] = useState(null);
  const [focus, setFocus] = useState(null);

  const routes = state.routes.filter((r) => r.date === date).sort((a, b) => a.id - b.id);
  const ready = state.orders.filter((o) => o.deliveryDate === date && o.status === "READY");
  const waiting = state.orders.filter((o) => o.deliveryDate === date && ["PENDING", "CONFIRMED"].includes(o.status));
  const busyVehicles = new Set(routes.filter((r) => r.status !== "DRAFT").map((r) => r.vehicleId));
  const freeVehicles = state.vehicles.filter((v) => v.active && !busyVehicles.has(v.id));
  const vehicleIds = picked ?? freeVehicles.map((v) => v.id);
  const order = (id) => state.orders.find((o) => o.id === id);
  const product = (id) => state.products.find((p) => p.id === id);
  const volumeOf = (o) => o.items.reduce((s, it) => s + product(it.productId).volume * it.qty, 0);

  const mapRoutes = useMemo(() => routes.map((r, i) => ({
    id: r.id, name: r.code, status: r.status, color: ROUTE_COLORS[i % ROUTE_COLORS.length],
    stops: r.stops.map((s) => {
      const o = order(s.orderId);
      return { lat: o.lat, lng: o.lng, seq: s.seq, label: `${s.seq}. ${o.code} — ${o.address}`, state: s.completedAt != null ? "done" : s.arrivedAt != null ? "here" : "" };
    }),
  })), [routes, state.orders]);
  const loose = ready.filter((o) => o.lat != null).map((o) => ({ lat: o.lat, lng: o.lng, label: `${o.code} — chưa xếp tuyến` }));

  const run = () => {
    const res = actions.optimizeDay(date, vehicleIds);
    if (res) setResult(res);
  };

  const usedDrivers = (r) => new Set(routes.filter((x) => x.id !== r.id).map((x) => x.driverId));

  return (
    <>
      <PageHead title="Điều phối giao hàng" sub="Gom đơn sẵn sàng, chạy tối ưu tuyến, duyệt và xuất kho.">
        <Seg value={date === today ? "t" : date === addDays(today, 1) ? "m" : "x"} onChange={(v) => { setDate(v === "t" ? today : addDays(today, 1)); setResult(null); setFocus(null); }}
          items={[{ value: "t", label: "Hôm nay" }, { value: "m", label: "Ngày mai" }]} />
        <input type="date" className="input" style={{ width: 160 }} value={date} onChange={(e) => { setDate(e.target.value); setResult(null); setFocus(null); }} aria-label="Chọn ngày" />
      </PageHead>

      <div className="dispatch">
        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h3>Chờ xếp tuyến</h3><span className="badge info plain">{ready.length} đơn</span></div>
            <div className="panel-body stack-sm" style={{ maxHeight: 300, overflowY: "auto" }}>
              {ready.length === 0 && <p className="small muted">Không có đơn sẵn sàng giao cho {dateLabel(date).toLowerCase()}.</p>}
              {ready.map((o) => (
                <div key={o.id} className="row between small" style={{ borderBottom: "1px solid var(--line-soft)", paddingBottom: 6 }}>
                  <div className="grow">
                    <Link href={`/admin/orders/${o.id}`} className="strong">{o.code}</Link> <span className="muted">{o.district}</span>
                    <div className="tiny muted">{o.window.start}–{o.window.end} · {num(volumeOf(o), 2)} m³</div>
                  </div>
                  {o.lat == null && <span className="badge move plain">Thiếu vị trí</span>}
                </div>
              ))}
              {waiting.length > 0 && <p className="tiny muted">Còn {waiting.length} đơn chưa xác nhận hoặc chưa chuẩn bị xong hàng cho ngày này.</p>}
            </div>
          </section>

          <Can perm="route.optimize" fallback={<div className="notice">Bạn có thể xem lịch giao. Việc chạy tối ưu và chốt tuyến do quản lý điều phối thực hiện.</div>}>
            <section className="panel">
              <div className="panel-head"><h3>Tối ưu tuyến</h3></div>
              <div className="panel-body stack">
                <div className="stack-sm">
                  <span className="small strong muted">Xe tham gia</span>
                  {state.vehicles.filter((v) => v.active).map((v) => {
                    const busy = busyVehicles.has(v.id);
                    return (
                      <label key={v.id} className="check" style={{ opacity: busy ? 0.5 : 1 }}>
                        <input type="checkbox" disabled={busy} checked={!busy && vehicleIds.includes(v.id)}
                          onChange={(e) => setPicked(e.target.checked ? [...vehicleIds, v.id] : vehicleIds.filter((x) => x !== v.id))} />
                        <span>{v.plate} <span className="muted small">{v.type}, {v.capacity} m³{busy ? ", đã có tuyến chốt" : ""}</span></span>
                      </label>
                    );
                  })}
                </div>
                <div className="small muted">
                  Ràng buộc: khung giờ khách, sức chứa xe, giờ làm việc {state.settings.dayStart}–{state.settings.dayEnd}, thời gian lắp đặt từng sản phẩm.
                  Tuyến đã chốt được giữ nguyên.
                </div>
                <button className="btn lg block" disabled={!ready.length || !vehicleIds.length} onClick={run}>
                  {routes.some((r) => r.status === "DRAFT") ? "Tối ưu lại tuyến nháp" : "Chạy tối ưu tuyến"}
                </button>
                {result && (
                  <div className="notice ok stack-sm">
                    <b>Đã xếp {result.orders} đơn vào {result.routes.length} tuyến trong {result.ms} ms.</b>
                    <span>Tổng {result.totalKm} km so với {result.baselineKm} km nếu giao theo thứ tự đặt hàng, tiết kiệm {result.savingPercent}%.</span>
                    {result.unassigned.length > 0 && <span style={{ color: "var(--stop)" }}>Không xếp được (vượt khung giờ hoặc sức chứa): {result.unassigned.join(", ")}</span>}
                    {result.missing.length > 0 && <span style={{ color: "var(--move)" }}>Thiếu vị trí, chưa đưa vào tối ưu: {result.missing.join(", ")}</span>}
                  </div>
                )}
              </div>
            </section>
          </Can>
        </div>

        <div className="stack">
          {routes.length === 0 && loose.length === 0 ? (
            <div className="panel"><Empty title={`Chưa có tuyến cho ${dateLabel(date).toLowerCase()}`}>Khi có đơn sẵn sàng giao, chạy tối ưu để hệ thống đề xuất tuyến.</Empty></div>
          ) : (
            <RouteMap depot={state.settings.depot} routes={mapRoutes} loose={loose} focusId={focus} />
          )}
          {routes.map((r, i) => {
            const driver = state.drivers.find((d) => d.id === r.driverId);
            const vehicle = state.vehicles.find((v) => v.id === r.vehicleId);
            const load = r.stops.reduce((s, st) => s + volumeOf(order(st.orderId)), 0);
            const done = r.stops.filter((s) => s.completedAt != null).length;
            const editable = ["DRAFT", "LOCKED"].includes(r.status);
            return (
              <section key={r.id} className="route-card" onMouseEnter={() => setFocus(r.id)} onMouseLeave={() => setFocus(null)}>
                <div className="rc-head">
                  <span className="swatch" style={{ background: ROUTE_COLORS[i % ROUTE_COLORS.length] }} />
                  <b>{r.code}</b>
                  <RouteBadge status={r.status} />
                  <span className="small muted grow">{vehicle?.plate}, tải {num(load, 1)}/{vehicle?.capacity} m³ · {r.totalKm} km · {Math.floor(r.totalMin / 60)}h{String(r.totalMin % 60).padStart(2, "0")} · thủ công {r.baselineKm} km</span>
                  <Link href={`/admin/routes/${r.id}`} className="btn ghost sm">Chi tiết</Link>
                </div>
                <div className="row" style={{ padding: "10px 14px", borderBottom: "1px solid var(--line-soft)" }}>
                  <span className="small muted">Tài xế</span>
                  {can("route.dispatch") && editable ? (
                    <select className="input" style={{ width: 220 }} value={r.driverId || ""} onChange={(e) => actions.assignDriver(r.id, Number(e.target.value))} aria-label="Tài xế">
                      <option value="" disabled>Chọn tài xế</option>
                      {state.drivers.filter((d) => d.active).map((d) => (
                        <option key={d.id} value={d.id} disabled={usedDrivers(r).has(d.id)}>{d.name}{usedDrivers(r).has(d.id) ? " (đã có tuyến)" : ""}</option>
                      ))}
                    </select>
                  ) : (
                    <b className="small">{driver?.name || "Chưa phân công"}</b>
                  )}
                  <span className="grow" />
                  {r.status === "IN_PROGRESS" && <span className="small muted">Đã giao {done}/{r.stops.length} điểm</span>}
                  <Can perm="route.approve">
                    {r.status === "DRAFT" && <button className="btn sm" onClick={() => actions.lockRoute(r.id)}>Duyệt và chốt tuyến</button>}
                    {r.status === "LOCKED" && <button className="btn ghost sm" onClick={() => actions.unlockRoute(r.id)}>Mở lại</button>}
                  </Can>
                  <Can perm="route.dispatch">
                    {r.status === "LOCKED" && <button className="btn go sm" onClick={() => actions.startRoute(r.id)}>Xuất kho</button>}
                  </Can>
                </div>
                <ol className="stop-list">
                  {r.stops.map((s) => {
                    const o = order(s.orderId);
                    const late = s.arrivedAt != null && s.arrivedAt > Number(o.window.end.split(":")[0]) * 60 + Number(o.window.end.split(":")[1]);
                    return (
                      <li key={s.seq}>
                        <span className={`seq ${s.completedAt != null ? "done" : s.arrivedAt != null ? "here" : ""}`} style={s.completedAt == null && s.arrivedAt == null ? { background: ROUTE_COLORS[i % ROUTE_COLORS.length] } : undefined}>{s.seq}</span>
                        <div>
                          <Link href={`/admin/orders/${o.id}`} className="strong">{o.code}</Link> {o.customerName}
                          <div className="tiny muted">{o.address}</div>
                        </div>
                        <div className="right nowrap">
                          <div className="strong">{hm(s.completedAt != null ? s.arrivedAt : s.planned)}</div>
                          <div className="tiny" style={{ color: late ? "var(--stop)" : "var(--muted)" }}>
                            {s.result === "FAILED" ? "Thất bại" : s.completedAt != null ? (late ? "Trễ hẹn" : "Đã giao") : `hẹn ${o.window.start}–${o.window.end}`}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
          <p className="tiny muted">{Object.entries(ROUTE_STATUS).map(([k, v]) => `${v.label}: ${v.hint}`).join(". ")}.</p>
        </div>
      </div>
    </>
  );
}

export default function DispatchPage() {
  return <RequirePerm perm="dispatch.view"><Dispatch /></RequirePerm>;
}
