"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Field, Modal } from "@/components/ui";

export default function Profile() {
  const { state, user, actions } = useStore();
  const customer = state.customers.find((c) => c.id === user.customerId);
  const [info, setInfo] = useState({ name: user.name, email: user.email });
  const [pw, setPw] = useState({ old: "", next: "" });
  const [editing, setEditing] = useState(null);

  return (
    <div className="stack">
      <h1>Tài khoản và địa chỉ</h1>
      <section className="panel">
        <div className="panel-head"><h3>Thông tin cá nhân</h3></div>
        <form className="panel-body form-grid" onSubmit={(e) => { e.preventDefault(); actions.updateProfile(info); }}>
          <Field label="Họ tên"><input className="input" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} required /></Field>
          <Field label="Số điện thoại" hint="Dùng để đăng nhập và tra cứu đơn, liên hệ cửa hàng để đổi"><input className="input" value={user.phone} disabled /></Field>
          <Field label="Email"><input className="input" type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} /></Field>
          <div className="row end full"><button className="btn">Lưu thông tin</button></div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h3>Sổ địa chỉ</h3>
          <button className="btn secondary sm" onClick={() => setEditing({ label: "", address: "", district: "", lat: "", lng: "" })}>Thêm địa chỉ</button>
        </div>
        <div className="panel-body stack-sm">
          {customer.addresses.length === 0 && <p className="muted small">Chưa có địa chỉ. Thêm địa chỉ để đặt hàng nhanh hơn.</p>}
          {customer.addresses.map((a) => (
            <div key={a.id} className="row between" style={{ padding: "10px 0", borderBottom: "1px solid var(--line-soft)" }}>
              <div className="grow">
                <b>{a.label}</b>
                <div className="small muted">{a.address}</div>
                <div className="tiny faint">{a.lat != null ? `Đã có vị trí ${a.lat}, ${a.lng}` : "Chưa có vị trí trên bản đồ"}</div>
              </div>
              <button className="btn ghost sm" onClick={() => setEditing(a)}>Sửa</button>
              <button className="btn ghost sm" onClick={() => actions.removeAddress(a.id)}>Xoá</button>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Đổi mật khẩu</h3></div>
        <form className="panel-body form-grid" onSubmit={(e) => { e.preventDefault(); if (pw.next.length < 6) return; actions.changePassword(pw.old, pw.next); setPw({ old: "", next: "" }); }}>
          <Field label="Mật khẩu hiện tại"><input className="input" type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} required /></Field>
          <Field label="Mật khẩu mới" hint="Ít nhất 6 ký tự"><input className="input" type="password" minLength={6} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></Field>
          <div className="row end full"><button className="btn secondary">Đổi mật khẩu</button></div>
        </form>
      </section>

      {editing && (
        <Modal title={editing.id ? "Sửa địa chỉ" : "Thêm địa chỉ"} onClose={() => setEditing(null)}
          footer={<><button className="btn secondary" onClick={() => setEditing(null)}>Huỷ</button><button className="btn" onClick={() => {
            if (!editing.label || editing.address.length < 8) return;
            actions.saveAddress({ ...editing, lat: editing.lat === "" ? null : Number(editing.lat), lng: editing.lng === "" ? null : Number(editing.lng) });
            setEditing(null);
          }}>Lưu địa chỉ</button></>}>
          <div className="form-grid">
            <Field label="Tên gợi nhớ"><input className="input" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Nhà riêng, Công ty…" /></Field>
            <Field label="Quận / huyện"><input className="input" value={editing.district} onChange={(e) => setEditing({ ...editing, district: e.target.value })} /></Field>
            <Field label="Địa chỉ" full><input className="input" value={editing.address} onChange={(e) => setEditing({ ...editing, address: e.target.value })} /></Field>
            <Field label="Vĩ độ" hint="Không bắt buộc"><input className="input" value={editing.lat ?? ""} onChange={(e) => setEditing({ ...editing, lat: e.target.value })} /></Field>
            <Field label="Kinh độ"><input className="input" value={editing.lng ?? ""} onChange={(e) => setEditing({ ...editing, lng: e.target.value })} /></Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
