"use client";
import Link from "next/link";
import { useState } from "react";
import { api } from "@/lib/api";
import { Field } from "@/components/ui";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Vui lòng nhập email hợp lệ.");
    setBusy(true); setError("");
    try { await api("/api/auth/otp", { method: "POST", body: { email, purpose: "reset" } }); setSent(true); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  const submit = async e => {
    e.preventDefault();
    if (password.length < 8 || password !== confirm) return setError("Mật khẩu cần ít nhất 8 ký tự và phải khớp nhau.");
    setBusy(true); setError("");
    try { await api("/api/auth/reset-password", { method: "POST", body: { email, otp, newPassword: password } }); setDone(true); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  };
  return <div className="auth-wrap"><aside className="auth-side"><Link href="/" className="logo"><span className="logo-mark">TV</span>Thông Vân</Link><h2>Khôi phục tài khoản</h2><p>Nhận mã xác nhận qua email để đặt lại mật khẩu.</p></aside><main className="auth-main"><form className="auth-box stack" onSubmit={submit}><h1>Quên mật khẩu</h1>{done ? <><div className="notice ok">Đã đặt lại mật khẩu thành công.</div><Link href="/login">Đăng nhập</Link></> : <><Field label="Email"><input className="input" type="email" required value={email} onChange={e => { setEmail(e.target.value); setSent(false); }} /></Field><button type="button" className="btn secondary" disabled={busy} onClick={send}>{sent ? "Gửi lại mã" : "Gửi mã xác nhận"}</button>{sent && <><div className="notice ok">Nếu email hợp lệ, mã đã được gửi. Mã có hiệu lực 3 phút từ lần gửi đầu tiên.</div><Field label="Mã xác nhận 6 số"><input className="input" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={otp} onChange={e => setOtp(e.target.value)} /></Field><Field label="Mật khẩu mới"><input className="input" type="password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></Field><Field label="Nhập lại mật khẩu"><input className="input" type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} /></Field><button className="btn lg" disabled={busy}>Đặt lại mật khẩu</button></>}{error && <div className="notice bad">{error}</div>}<Link href="/login">Quay lại đăng nhập</Link></>}</form></main></div>;
}
