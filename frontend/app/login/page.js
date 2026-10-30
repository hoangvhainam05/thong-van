"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { homeFor } from "@/lib/rbac";
import { Field, Loading } from "@/components/ui";

function LoginForm() {
  const { ready, actions } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  if (!ready) return <Loading />;

  const go = async (identifier, password) => {
    const res = await actions.login(identifier, password);
    if (!res.ok) return setError(res.error);
    const next = params.get("next");
    router.push(next && next.startsWith("/") ? next : homeFor({ [res.user.role]: res.user.permissions }, res.user.role));
  };

  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <Link href="/" className="logo"><span className="logo-mark">TV</span>Thông Vân</Link>
        <div className="stack">
          <h2>Một tài khoản, đúng việc của bạn</h2>
          <p>Khách hàng theo dõi đơn và thứ tự giao. Nhân viên bán hàng xử lý đơn. Quản lý xếp tuyến và chốt lịch. Tài xế nhận tuyến và cập nhật từng điểm giao.</p>
        </div>
        <p className="small">Đăng nhập bằng tài khoản đã được cấp hoặc tạo tài khoản khách hàng.</p>
      </aside>
      <main className="auth-main">
        <div className="auth-box stack">
          <div>
            <h1>Đăng nhập</h1>
            <p className="muted" style={{ marginTop: 4 }}>Chưa có tài khoản? <Link href="/register" style={{ color: "var(--road)", fontWeight: 600 }}>Đăng ký</Link></p>
          </div>
          <form className="stack" onSubmit={(e) => { e.preventDefault(); go(id, pw); }}>
            <Field label="Email hoặc số điện thoại"><input className="input" value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" required /></Field>
            <Field label="Mật khẩu"><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="current-password" required /></Field>
            <Link href="/forgot-password" className="small">Quên mật khẩu?</Link>
            {error && <div className="notice bad">{error}</div>}
            <button className="btn lg block">Đăng nhập</button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<Loading />}><LoginForm /></Suspense>;
}

