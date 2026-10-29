"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Field, Loading } from "@/components/ui";

export default function RegisterPage() {
  const { ready, actions } = useStore();
  const router = useRouter();
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  if (!ready) return <Loading />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!/^0\d{9}$/.test(f.phone)) return setError("Số điện thoại cần có 10 chữ số, bắt đầu bằng 0.");
    if (f.password.length < 8) return setError("Mật khẩu cần ít nhất 8 ký tự.");
    if (f.password !== f.confirm) return setError("Hai mật khẩu chưa khớp nhau.");
    const res = await actions.register(f);
    if (!res.ok) return setError(res.error);
    router.push("/account/profile");
  };

  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <Link href="/" className="logo"><span className="logo-mark">TV</span>Thông Vân</Link>
        <div className="stack">
          <h2>Tạo tài khoản khách hàng</h2>
          <p>Lưu địa chỉ giao hàng, xem lại đơn đã mua và nhận thông báo khi xe sắp tới.</p>
        </div>
        <p className="small">Tài khoản nhân viên do quản trị viên tạo trong trang quản trị.</p>
      </aside>
      <main className="auth-main">
        <form className="auth-box stack" onSubmit={submit}>
          <div>
            <h1>Đăng ký</h1>
            <p className="muted" style={{ marginTop: 4 }}>Đã có tài khoản? <Link href="/login" style={{ color: "var(--road)", fontWeight: 600 }}>Đăng nhập</Link></p>
          </div>
          <Field label="Họ tên"><input className="input" value={f.name} onChange={set("name")} required /></Field>
          <Field label="Số điện thoại" hint="Dùng để đăng nhập và tra cứu đơn"><input className="input" value={f.phone} onChange={set("phone")} inputMode="tel" required /></Field>
          <Field label="Email (không bắt buộc)"><input className="input" type="email" value={f.email} onChange={set("email")} /></Field>
          <div className="form-grid">
            <Field label="Mật khẩu"><input className="input" type="password" value={f.password} onChange={set("password")} required /></Field>
            <Field label="Nhập lại mật khẩu"><input className="input" type="password" value={f.confirm} onChange={set("confirm")} required /></Field>
          </div>
          {error && <div className="notice bad">{error}</div>}
          <button className="btn lg block">Tạo tài khoản</button>
        </form>
      </main>
    </div>
  );
}
