"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { homeFor } from "@/lib/rbac";
import { Avatar, Field, Loading, RoleChip } from "@/components/ui";

const DEMO = [
  ["khach@thongvan.vn", "Có đơn đang giao hôm nay"],
  ["admin@thongvan.vn", "Toàn quyền, quản lý tài khoản và phân quyền"],
  ["quanly@thongvan.vn", "Tối ưu, chốt tuyến, xuất kho"],
  ["banhang@thongvan.vn", "Xác nhận đơn, quản lý sản phẩm"],
  ["taixe1@thongvan.vn", "Ứng dụng giao hàng"],
];

function LoginForm() {
  const { ready, state, actions } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");
  if (!ready) return <Loading />;

  const go = (identifier, password) => {
    const res = actions.login(identifier, password);
    if (!res.ok) return setError(res.error);
    const next = params.get("next");
    router.push(next && next.startsWith("/") ? next : homeFor(state.roleMatrix, res.user.role));
  };

  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <Link href="/" className="logo"><span className="logo-mark">TV</span>Thông Vân</Link>
        <div className="stack">
          <h2>Một tài khoản, đúng việc của bạn</h2>
          <p>Khách hàng theo dõi đơn và thứ tự giao. Nhân viên bán hàng xử lý đơn. Quản lý xếp tuyến và chốt lịch. Tài xế nhận tuyến và cập nhật từng điểm giao.</p>
        </div>
        <p className="small">Bản demo: dữ liệu lưu trong trình duyệt của bạn, mọi tài khoản mẫu dùng mật khẩu 123456.</p>
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
            {error && <div className="notice bad">{error}</div>}
            <button className="btn lg block">Đăng nhập</button>
          </form>
          <div className="stack-sm">
            <div className="small strong muted">Đăng nhập nhanh bằng tài khoản mẫu</div>
            <div className="demo-accounts">
              {DEMO.map(([email, hint]) => {
                const u = state.users.find((x) => x.email === email);
                if (!u) return null;
                return (
                  <button key={email} type="button" onClick={() => go(email, u.password)}>
                    <Avatar name={u.name} />
                    <span className="grow">
                      <span className="row" style={{ gap: 8 }}><b>{u.name}</b><RoleChip role={u.role} /></span>
                      <span className="small muted">{hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<Loading />}><LoginForm /></Suspense>;
}

