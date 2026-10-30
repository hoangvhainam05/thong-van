"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Field, Loading } from "@/components/ui";

export default function RegisterPage() {
  const { ready, actions } = useStore();
  const router = useRouter();
  const [f, setF] = useState({ name: "", phone: "", email: "", password: "", confirm: "" });
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (!ready) return <Loading />;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (!/^0\d{9}$/.test(f.phone)) return setError("Số điện thoại cần có 10 chữ số, bắt đầu bằng 0.");
    if (f.password.length < 8) return setError("Mật khẩu cần ít nhất 8 ký tự.");
    if (f.password !== f.confirm) return setError("Hai mật khẩu chưa khớp nhau.");
    setBusy(true);
    const res = await actions.register(f);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.push("/account/profile");
  };

  const sendOtp = async () => {
    if (!f.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return setError("Vui lòng nhập email hợp lệ.");
    setBusy(true); setError("");
    try { await api("/api/auth/otp", { method: "POST", body: { email: f.email, purpose: "register" } }); setSent(true); setMessage("Đã gửi mã đến email. Mã có hiệu lực 3 phút từ lần gửi đầu tiên."); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
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
          <Field label="Email"><input className="input" type="email" value={f.email} onChange={(e) => { set("email")(e); setSent(false); }} required /></Field>
          <div className="form-grid">
            <Field label="Mật khẩu"><input className="input" type="password" value={f.password} onChange={set("password")} required /></Field>
            <Field label="Nhập lại mật khẩu"><input className="input" type="password" value={f.confirm} onChange={set("confirm")} required /></Field>
          </div>
          <button type="button" className="btn secondary" disabled={busy} onClick={sendOtp}>{sent ? "Gửi lại mã" : "Gửi mã xác nhận"}</button>
          {sent && <Field label="Mã xác nhận 6 số"><input className="input" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={f.otp || ""} onChange={set("otp")} required /></Field>}
          {message && sent && <div className="notice ok">{message}</div>}
          {error && <div className="notice bad">{error}</div>}
          <button className="btn lg block" disabled={!sent || busy}>Tạo tài khoản</button>
        </form>
      </main>
    </div>
  );
}
