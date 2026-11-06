"use client";

import { useEffect, useState } from "react";
import { api, loadToken } from "@/lib/api";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Field, Modal, Tabs } from "@/components/ui";

function Fleet() {
  const [tab, setTab] = useState("drivers");
  const [token, setToken] = useState("");
  const [drivers, setDrivers] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setToken(loadToken()); }, []);
  async function refresh(credential = token) {
    if (!credential) return;
    try {
      const [nextDrivers, nextVehicles] = await Promise.all([
        api("/api/drivers", { token: credential }),
        api("/api/vehicles", { token: credential }),
      ]);
      setDrivers(nextDrivers);
      setVehicles(nextVehicles);
      setError("");
    } catch (err) {
      setError(err.message || "Không tải được dữ liệu xe và tài xế.");
    }
  }
  useEffect(() => { if (token) refresh(token); }, [token]);

  async function save() {
    setBusy(true);
    setError("");
    try {
      const kind = edit.kind;
      const driver_ids = kind === "vehicle"
        ? [edit.driverId1, edit.driverId2].filter(Boolean).map(Number)
        : undefined;
      const body = kind === "driver"
        ? { name: edit.name.trim(), phone: edit.phone.trim(), active: edit.active }
        : {
            plate: edit.plate.trim(),
            capacity_m3: Number(edit.capacity_m3),
            capacity_kg: Number(edit.capacity_kg),
            active: edit.active,
            driver_ids,
          };
      await api("/api/" + (kind === "driver" ? "drivers" : "vehicles") + (edit.id ? "/" + edit.id : ""), {
        method: edit.id ? "PATCH" : "POST", token, body,
      });
      setEdit(null);
      await refresh();
    } catch (err) {
      setError(err.message || "Không lưu được thông tin.");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(kind, item) {
    setBusy(true);
    try {
      await api("/api/" + kind + "/" + item.id, { method: "PATCH", token, body: { active: !item.active } });
      await refresh();
    } catch (err) {
      setError(err.message || "Không cập nhật được trạng thái.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageHead title="Tài xế và xe" sub="Năng lực vận chuyển được dùng trực tiếp trong tối ưu tuyến.">
      <button className="btn" disabled={!token} onClick={() => setEdit(tab === "drivers" ? { kind: "driver", name: "", phone: "", active: true } : { kind: "vehicle", plate: "", capacity_m3: 3.5, capacity_kg: 800, active: true, driverId1: "", driverId2: "" })}>{tab === "drivers" ? "Thêm tài xế" : "Thêm xe"}</button>
    </PageHead>
    {error && <div className="notice bad" style={{ marginBottom: 14 }}>{error}</div>}
    <section className="panel">
      <div style={{ padding: "0 12px" }}><Tabs value={tab} onChange={setTab} items={[{ value: "drivers", label: "Tài xế", count: drivers.length }, { value: "vehicles", label: "Xe", count: vehicles.length }]} /></div>
      <div className="table-wrap"><table className="table">
        <thead><tr>{tab === "drivers" ? <><th>Tài xế</th><th>Số điện thoại</th><th>Xe phụ trách</th><th>Trạng thái</th><th></th></> : <><th>Biển số</th><th>Thể tích</th><th>Tải trọng</th><th>Tài xế phụ trách</th><th>Trạng thái</th><th></th></>}</tr></thead>
        <tbody>{tab === "drivers" ? drivers.map((driver) => <tr key={driver.id}>
          <td><b>{driver.name}</b></td><td>{driver.phone}</td><td>{driver.vehicle_plate ? <b>{driver.vehicle_plate}</b> : <span className="small muted">Chưa liên kết</span>}</td><td>{driver.active ? "Đang làm" : "Nghỉ"}</td>
          <td className="nowrap"><button className="btn ghost sm" disabled={busy} onClick={() => setEdit({ ...driver, kind: "driver" })}>Sửa</button><button className="btn ghost sm" disabled={busy} onClick={() => toggle("drivers", driver)}>{driver.active ? "Cho nghỉ" : "Đi làm lại"}</button></td>
        </tr>) : vehicles.map((vehicle) => <tr key={vehicle.id}>
          <td><b>{vehicle.plate}</b></td><td>{vehicle.capacity_m3} m³</td><td>{vehicle.capacity_kg} kg</td>
          <td>
            {vehicle.drivers && vehicle.drivers.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {vehicle.drivers.map((d) => (
                  <span key={d.id} className="badge sm">
                    {d.name}
                  </span>
                ))}
              </div>
            ) : (
              <span className="small muted">Chưa gán</span>
            )}
          </td>
          <td>{vehicle.active ? "Sẵn sàng" : "Bảo dưỡng"}</td>
          <td className="nowrap"><button className="btn ghost sm" disabled={busy} onClick={() => setEdit({ ...vehicle, kind: "vehicle", driverId1: vehicle.driver_ids?.[0] ? String(vehicle.driver_ids[0]) : "", driverId2: vehicle.driver_ids?.[1] ? String(vehicle.driver_ids[1]) : "" })}>Sửa</button><button className="btn ghost sm" disabled={busy} onClick={() => toggle("vehicles", vehicle)}>{vehicle.active ? "Bảo dưỡng" : "Đưa vào hoạt động"}</button></td>
        </tr>)}</tbody>
      </table></div>
    </section>
    {edit && <Modal title={edit.kind === "driver" ? "Thông tin tài xế" : "Thông tin xe"} onClose={() => setEdit(null)} footer={<><button className="btn secondary" onClick={() => setEdit(null)}>Huỷ</button><button className="btn" disabled={busy} onClick={save}>{busy ? "Đang lưu…" : "Lưu"}</button></>}>
      <div className="form-grid">
        {edit.kind === "driver" ? <>
          <Field label="Họ tên" full><input className="input" value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} /></Field>
          <Field label="Số điện thoại" full><input className="input" value={edit.phone} onChange={(event) => setEdit({ ...edit, phone: event.target.value })} /></Field>
        </> : <>
          <Field label="Biển số" full><input className="input" value={edit.plate} onChange={(event) => setEdit({ ...edit, plate: event.target.value })} /></Field>
          <Field label="Thể tích thùng (m³)"><input className="input" type="number" min="0.01" step="0.01" value={edit.capacity_m3} onChange={(event) => setEdit({ ...edit, capacity_m3: event.target.value })} /></Field>
          <Field label="Tải trọng (kg)"><input className="input" type="number" min="1" step="1" value={edit.capacity_kg} onChange={(event) => setEdit({ ...edit, capacity_kg: event.target.value })} /></Field>
          <Field label="Tài xế 1 (Chính)" hint="Tuỳ chọn — có thể gán hoặc để trống" full>
            <select className="input" value={edit.driverId1 || ""} onChange={(e) => setEdit({ ...edit, driverId1: e.target.value })}>
              <option value="">-- Chưa gán tài xế --</option>
              {drivers.filter(d => d.active).map(d => (
                <option key={d.id} value={d.id} disabled={String(d.id) === String(edit.driverId2)}>
                  {d.name} — {d.phone}{d.vehicle_plate && d.vehicle_id !== edit.id ? ` (hiện ở ${d.vehicle_plate})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tài xế 2 (Phụ / Thay phiên)" hint="Tuỳ chọn — tối đa 2 tài cho mỗi xe" full>
            <select className="input" value={edit.driverId2 || ""} onChange={(e) => setEdit({ ...edit, driverId2: e.target.value })}>
              <option value="">-- Không có tài xế 2 --</option>
              {drivers.filter(d => d.active).map(d => (
                <option key={d.id} value={d.id} disabled={String(d.id) === String(edit.driverId1)}>
                  {d.name} — {d.phone}{d.vehicle_plate && d.vehicle_id !== edit.id ? ` (hiện ở ${d.vehicle_plate})` : ''}
                </option>
              ))}
            </select>
          </Field>
        </>}
      </div>
    </Modal>}
  </>;
}

export default function FleetPage() {
  return <RequirePerm perm="fleet.manage"><Fleet /></RequirePerm>;
}
