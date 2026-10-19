"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { vnd } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Field } from "@/components/ui";

function Settings() {
  const { state, actions } = useStore();
  const [s, setS] = useState(state.settings);
  const set = (k, num) => (e) => setS({ ...s, [k]: num ? Number(e.target.value) : e.target.value });

  return (
    <>
      <PageHead title="Cài đặt" sub="Tham số cho bộ tối ưu tuyến và phí giao hàng." />
      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h3>Kho xuất hàng</h3></div>
          <div className="panel-body form-grid">
            <Field label="Tên kho" full><input className="input" value={s.depot.name} onChange={(e) => setS({ ...s, depot: { ...s.depot, name: e.target.value } })} /></Field>
            <Field label="Địa chỉ" full><input className="input" value={s.depot.address} onChange={(e) => setS({ ...s, depot: { ...s.depot, address: e.target.value } })} /></Field>
            <Field label="Vĩ độ"><input className="input" type="number" step="0.0001" value={s.depot.lat} onChange={(e) => setS({ ...s, depot: { ...s.depot, lat: Number(e.target.value) } })} /></Field>
            <Field label="Kinh độ"><input className="input" type="number" step="0.0001" value={s.depot.lng} onChange={(e) => setS({ ...s, depot: { ...s.depot, lng: Number(e.target.value) } })} /></Field>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Tối ưu tuyến</h3></div>
          <div className="panel-body form-grid">
            <Field label="Bắt đầu giao"><input className="input" type="time" value={s.dayStart} onChange={set("dayStart")} /></Field>
            <Field label="Kết thúc ngày"><input className="input" type="time" value={s.dayEnd} onChange={set("dayEnd")} /></Field>
            <Field label="Tốc độ trung bình (km/h)"><input className="input" type="number" value={s.speed} onChange={set("speed", true)} /></Field>
            <Field label="Hệ số đường bộ" hint="Quãng đường thật / đường chim bay"><input className="input" type="number" step="0.05" value={s.roadFactor} onChange={set("roadFactor", true)} /></Field>
            <Field label="Trọng số quãng đường"><input className="input" type="number" step="0.1" value={s.wKm} onChange={set("wKm", true)} /></Field>
            <Field label="Trọng số thời gian" hint="Tăng để ưu tiên về kho sớm"><input className="input" type="number" step="0.1" value={s.wTime} onChange={set("wTime", true)} /></Field>
            <Field label="Thời gian dỡ hàng mỗi điểm (phút)"><input className="input" type="number" value={s.unloadMin} onChange={set("unloadMin", true)} /></Field>
            <p className="small muted full">Hàm mục tiêu: tối thiểu {s.wKm} × tổng km + {s.wTime} × tổng phút, với ràng buộc khung giờ khách và sức chứa xe.</p>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Phí giao hàng</h3></div>
          <div className="panel-body form-grid">
            <Field label="Phí giao (₫)"><input className="input" type="number" step="10000" value={s.shippingFee} onChange={set("shippingFee", true)} /></Field>
            <Field label="Miễn phí cho đơn từ (₫)" hint={vnd(s.freeShipFrom)}><input className="input" type="number" step="100000" value={s.freeShipFrom} onChange={set("freeShipFrom", true)} /></Field>
          </div>
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Dữ liệu mẫu</h3></div>
          <div className="panel-body stack">
            <p className="small muted">Bản demo lưu dữ liệu trong trình duyệt. Khôi phục để quay về bộ dữ liệu mẫu ban đầu của hôm nay; phiên đăng nhập được giữ nguyên.</p>
            <div><button className="btn danger" onClick={() => confirm("Xoá mọi thay đổi và khôi phục dữ liệu mẫu?") && actions.resetDemo()}>Khôi phục dữ liệu mẫu</button></div>
          </div>
        </section>
      </div>
      <div className="row end" style={{ marginTop: 16 }}>
        <button className="btn secondary" onClick={() => setS(state.settings)}>Bỏ thay đổi</button>
        <button className="btn" onClick={() => actions.saveSettings(s)}>Lưu cài đặt</button>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return <RequirePerm perm="settings.manage"><Settings /></RequirePerm>;
}
