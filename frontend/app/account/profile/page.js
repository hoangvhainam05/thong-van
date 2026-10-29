"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { Field } from "@/components/ui";

export default function Profile() {
  const { user, actions } = useStore();
  const [info, setInfo] = useState({ name: user.name, email: user.email || "" });
  const [pw, setPw] = useState({ old: "", next: "" });

  return (
    <div className="stack">
      <h1>Tài khoản</h1>
      <section className="panel">
        <div className="panel-head"><h3>Thông tin cá nhân</h3></div>
        <form className="panel-body form-grid" onSubmit={(e) => { e.preventDefault(); actions.updateProfile(info); }}>
          <Field label="Họ tên"><input className="input" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} required /></Field>
          <Field label="Số điện thoại" hint="Dùng để đăng nhập và tra cứu đơn, liên hệ cửa hàng để đổi"><input className="input" value={user.phone || ""} disabled /></Field>
          <Field label="Email"><input className="input" type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} /></Field>
          <div className="row end full"><button className="btn">Lưu thông tin</button></div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-head"><h3>Đổi mật khẩu</h3></div>
        <form className="panel-body form-grid" onSubmit={(e) => { e.preventDefault(); if (pw.next.length < 8) return; actions.changePassword(pw.old, pw.next).then((ok) => { if (ok) setPw({ old: "", next: "" }); }); }}>
          <Field label="Mật khẩu hiện tại"><input className="input" type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} required /></Field>
          <Field label="Mật khẩu mới" hint="Ít nhất 8 ký tự"><input className="input" type="password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></Field>
          <div className="row end full"><button className="btn secondary">Đổi mật khẩu</button></div>
        </form>
      </section>


    </div>
  );
}
