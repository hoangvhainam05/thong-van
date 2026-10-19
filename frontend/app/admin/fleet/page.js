"use client";

import { useState } from "react";
import { dayStats, useStore } from "@/lib/store";
import { addDays, num, ymd } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Field, Modal, RouteBadge, Tabs } from "@/components/ui";

function Fleet() {
  const { state, actions } = useStore();
  const [tab, setTab] = useState("drivers");
  const [edit, setEdit] = useState(null);
  const today = ymd();
  const since = addDays(today, -30);

  const driverStats = (d) => {
    const rs = state.routes.filter((r) => r.driverId === d.id && r.date >= since && r.date <= today);
    const stops = rs.flatMap((r) => r.stops.filter((s) => s.completedAt != null).map((s) => ({ s, o: state.orders.find((o) => o.id === s.orderId) })));
    const onTime = stops.filter(({ s, o }) => s.arrivedAt <= Number(o.window.end.slice(0, 2)) * 60 + Number(o.window.end.slice(3))).length;
    return { routes: rs.length, stops: stops.length, km: rs.reduce((s, r) => s + r.totalKm, 0), onTime: stops.length ? Math.round((onTime / stops.length) * 100) : null, today: state.routes.find((r) => r.driverId === d.id && r.date === today) };
  };

  return (
    <>
      <PageHead title="Tài xế và xe" sub="Năng lực vận chuyển dùng cho tối ưu tuyến. Số liệu 30 ngày gần nhất.">
        <button className="btn" onClick={() => setEdit(tab === "drivers" ? { kind: "driver", name: "", phone: "", license: "B2" } : { kind: "vehicle", plate: "", type: "Xe tải 1,25 tấn", capacity: 6, capacityKg: 1250 })}>
          {tab === "drivers" ? "Thêm tài xế" : "Thêm xe"}
        </button>
      </PageHead>
      <div className="panel">
        <div style={{ padding: "0 12px" }}>
          <Tabs value={tab} onChange={setTab} items={[{ value: "drivers", label: "Tài xế", count: state.drivers.length }, { value: "vehicles", label: "Xe", count: state.vehicles.length }]} />
        </div>
        <div className="table-wrap">
          {tab === "drivers" ? (
            <table className="table">
              <thead><tr><th>Tài xế</th><th>Bằng lái</th><th>Hôm nay</th><th className="num">Tuyến</th><th className="num">Điểm giao</th><th className="num">Km</th><th className="num">Đúng hẹn</th><th></th></tr></thead>
              <tbody>
                {state.drivers.map((d) => {
                  const s = driverStats(d);
                  return (
                    <tr key={d.id} style={{ opacity: d.active ? 1 : 0.5 }}>
                      <td><b>{d.name}</b><div className="tiny muted">{d.phone}{d.userId ? "" : ", chưa có tài khoản đăng nhập"}</div></td>
                      <td>{d.license}</td>
                      <td>{!d.active ? <span className="badge">Nghỉ</span> : s.today ? <><span className="small strong">{s.today.code}</span> <RouteBadge status={s.today.status} /></> : <span className="tiny muted">Rảnh</span>}</td>
                      <td className="num">{s.routes}</td>
                      <td className="num">{s.stops}</td>
                      <td className="num">{num(s.km, 0)}</td>
                      <td className="num">{s.onTime != null ? `${s.onTime}%` : "—"}</td>
                      <td className="nowrap">
                        <button className="btn ghost sm" onClick={() => setEdit({ kind: "driver", ...d })}>Sửa</button>
                        <button className="btn ghost sm" onClick={() => actions.saveDriver({ ...d, active: !d.active })}>{d.active ? "Cho nghỉ" : "Đi làm lại"}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="table">
              <thead><tr><th>Biển số</th><th>Loại xe</th><th className="num">Thể tích</th><th className="num">Tải trọng</th><th>Hôm nay</th><th className="num">Km 30 ngày</th><th></th></tr></thead>
              <tbody>
                {state.vehicles.map((v) => {
                  const rs = state.routes.filter((r) => r.vehicleId === v.id && r.date >= since && r.date <= today);
                  const t = rs.find((r) => r.date === today);
                  return (
                    <tr key={v.id} style={{ opacity: v.active ? 1 : 0.5 }}>
                      <td><b>{v.plate}</b></td>
                      <td>{v.type}</td>
                      <td className="num">{v.capacity} m³</td>
                      <td className="num">{num(v.capacityKg)} kg</td>
                      <td>{!v.active ? <span className="badge">Bảo dưỡng</span> : t ? <><span className="small strong">{t.code}</span> <RouteBadge status={t.status} /></> : <span className="tiny muted">Sẵn sàng</span>}</td>
                      <td className="num">{num(rs.reduce((s, r) => s + r.totalKm, 0))}</td>
                      <td className="nowrap">
                        <button className="btn ghost sm" onClick={() => setEdit({ kind: "vehicle", ...v })}>Sửa</button>
                        <button className="btn ghost sm" onClick={() => actions.saveVehicle({ ...v, active: !v.active })}>{v.active ? "Đưa đi bảo dưỡng" : "Đưa vào hoạt động"}</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <p className="tiny muted" style={{ marginTop: 10 }}>Quãng đường tiết kiệm hôm qua: {num(dayStats(state, addDays(today, -1)).savedKm, 1)} km.</p>

      {edit && (
        <Modal title={edit.kind === "driver" ? (edit.id ? "Sửa tài xế" : "Thêm tài xế") : edit.id ? "Sửa xe" : "Thêm xe"} onClose={() => setEdit(null)}
          footer={<><button className="btn secondary" onClick={() => setEdit(null)}>Huỷ</button><button className="btn" onClick={() => {
            const { kind, ...x } = edit;
            if (kind === "driver") { if (!x.name || !x.phone) return; actions.saveDriver(x); }
            else { if (!x.plate) return; actions.saveVehicle({ ...x, capacity: Number(x.capacity), capacityKg: Number(x.capacityKg) }); }
            setEdit(null);
          }}>Lưu</button></>}>
          {edit.kind === "driver" ? (
            <div className="form-grid">
              <Field label="Họ tên" full><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
              <Field label="Số điện thoại"><input className="input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
              <Field label="Hạng bằng lái"><select className="input" value={edit.license} onChange={(e) => setEdit({ ...edit, license: e.target.value })}><option>B2</option><option>C</option></select></Field>
              <p className="small muted full">Để tài xế đăng nhập ứng dụng giao hàng, tạo tài khoản vai trò Nhân viên giao hàng ở trang Tài khoản.</p>
            </div>
          ) : (
            <div className="form-grid">
              <Field label="Biển số"><input className="input" value={edit.plate} onChange={(e) => setEdit({ ...edit, plate: e.target.value })} /></Field>
              <Field label="Loại xe"><input className="input" value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })} /></Field>
              <Field label="Thể tích thùng (m³)" hint="Ràng buộc sức chứa khi tối ưu"><input className="input" type="number" step="0.5" value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} /></Field>
              <Field label="Tải trọng (kg)"><input className="input" type="number" value={edit.capacityKg} onChange={(e) => setEdit({ ...edit, capacityKg: e.target.value })} /></Field>
            </div>
          )}
        </Modal>
      )}
    </>
  );
}

export default function FleetPage() {
  return <RequirePerm perm="fleet.manage"><Fleet /></RequirePerm>;
}
