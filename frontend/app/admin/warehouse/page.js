"use client";

import { useEffect, useState } from "react";
import { api, loadToken } from "@/lib/api";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Loading } from "@/components/ui";
import LocationPicker from "@/components/LocationPicker";

function Warehouse() {
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { api("/api/warehouse", { token: loadToken() }).then(setForm).catch(e => setError(e.message)); }, []);
  async function save(e) {
    e.preventDefault(); setError(""); setMessage("");
    if (!form.name.trim() || !form.address.trim() || form.lat === "" || form.lng === "") return setError("Vui lòng nhập tên, địa chỉ và vị trí kho.");
    setBusy(true);
    try {
      const saved = await api("/api/warehouse", { method: "PATCH", token: loadToken(), body: { name: form.name.trim(), address: form.address.trim(), lat: Number(form.lat), lng: Number(form.lng) } });
      setForm(saved); setMessage("Đã cập nhật kho xuất hàng.");
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <>
    <PageHead title="Kho xuất hàng" sub="Cập nhật địa chỉ và vị trí xuất phát cho các tuyến giao hàng." />
    {error && <div className="notice bad" role="alert">{error}</div>}
    {message && <div className="notice ok" role="status">{message}</div>}
    {!form ? (!error && <Loading />) : <form className="panel panel-pad stack-sm" onSubmit={save}>
      <label className="field"><span>Tên kho</span><input className="input" required maxLength={120} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
      <label className="field"><span>Địa chỉ kho</span><input className="input" required maxLength={255} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label>
      <div className="grid-2">
        <label className="field"><span>Vĩ độ</span><input className="input" type="number" required min="-90" max="90" step="any" value={form.lat} onChange={e => setForm({ ...form, lat: e.target.value })} /></label>
        <label className="field"><span>Kinh độ</span><input className="input" type="number" required min="-180" max="180" step="any" value={form.lng} onChange={e => setForm({ ...form, lng: e.target.value })} /></label>
      </div>
      <div><button type="button" className="btn secondary" onClick={() => setPicker(true)}>Chọn vị trí trên bản đồ</button></div>
      <p className="small muted">Kiểm tra ghim và địa chỉ trước khi lưu. Tuyến đã lập giữ vị trí kho cũ; tuyến tối ưu mới sẽ dùng vị trí vừa lưu.</p>
      <div><button className="btn" disabled={busy}>{busy ? "Đang lưu…" : "Lưu kho"}</button></div>
    </form>}
    {picker && <LocationPicker warehouse initial={form} onClose={() => setPicker(false)} onSelect={point => { setForm({ ...form, lat: point.lat, lng: point.lng, address: point.address || form.address }); setPicker(false); }} />}
  </>;
}
export default function WarehousePage() { return <RequirePerm perm="fleet.manage"><Warehouse /></RequirePerm>; }
