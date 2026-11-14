"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { homeFor } from "@/lib/rbac";
import { Field, Loading } from "@/components/ui";
import { playTap } from "@/lib/audio-juice";

function isAllowedNext(next, role, perms = []) {
  if (!next || typeof next !== "string" || !next.startsWith("/") || next === "/" || next === "/login") return false;
  if (next.startsWith("/admin")) return perms.includes("backoffice.access");
  if (next.startsWith("/driver")) return perms.includes("delivery.app");
  if (next.startsWith("/account")) return perms.includes("order.track_own");
  if (next.startsWith("/checkout")) return role === "CUSTOMER" || perms.includes("order.place");
  return true;
}

function LoginForm() {
  const { ready, actions, user, state } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (ready && user) {
      router.replace(homeFor(state?.roleMatrix, user.role));
    }
  }, [ready, user, state?.roleMatrix, router]);

  if (!ready || user) return <Loading />;

  const go = async (identifier, password) => {
    const res = await actions.login(identifier, password);
    if (!res.ok) return setError(res.error);
    const dest = homeFor({ [res.user.role]: res.user.permissions }, res.user.role);
    const next = params.get("next");
    const target = isAllowedNext(next, res.user.role, res.user.permissions) ? next : dest;
    router.push(target);
  };

  return (
    <div className="auth-wrap">
      <aside className="auth-side">
        <Link href="/" className="logo" onClick={() => playTap(800, 0.03)}>
          <img className="logo-image" src="/brand-logo.png" alt="Thông Vân — Điện tử thông minh, cuộc sống tiện nghi" />
        </Link>
        <div className="stack" style={{ gap: 20 }}>
          <div className="hud-badge hero-pill" style={{ width: "fit-content" }}>
            <span className="live-dot" />
            <span>HỆ THỐNG VẬN HÀNH THÔNG MINH</span>
          </div>
          <h2>Một tài khoản, đúng vị trí và quyền hạn của bạn</h2>
          <p>
            Khách hàng theo dõi vị trí xe và thời gian giao hàng trực tiếp. Nhân viên bán hàng xử lý đơn. Quản lý điều phối và tối ưu hóa tuyến đường. Tài xế nhận tuyến và cập nhật nghiệm thu.
          </p>
        </div>
        <p className="small" style={{ color: "#9bb7dc" }}>
          Đăng nhập bằng tài khoản đã được cấp hoặc tạo tài khoản khách hàng mới.
        </p>
      </aside>
      <main className="auth-main">
        <div className="auth-box panel panel-pad stack animate-pop-in" style={{ gap: 20, boxShadow: "0 16px 40px -10px rgba(15, 23, 42, 0.12)" }}>
          <div>
            <h1>Đăng nhập</h1>
            <p className="muted" style={{ marginTop: 6 }}>
              Chưa có tài khoản?{" "}
              <Link href="/register" style={{ color: "var(--road)", fontWeight: 600 }}>
                Đăng ký tài khoản mới
              </Link>
            </p>
          </div>
          <form className="stack" style={{ gap: 16 }} onSubmit={(e) => { e.preventDefault(); playTap(800, 0.03); go(id, pw); }}>
            <Field label="Email hoặc số điện thoại">
              <input
                className="input"
                value={id}
                onChange={(e) => setId(e.target.value)}
                autoComplete="username"
                placeholder="VD: user@thongvan.vn hoặc 09xx xxx xxx"
                required
              />
            </Field>
            <Field label="Mật khẩu">
              <input
                className="input"
                type="password"
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu…"
                required
              />
            </Field>
            <div className="row between" style={{ alignItems: "center" }}>
              <Link href="/forgot-password" className="small" style={{ color: "var(--road)", fontWeight: 500 }}>
                Quên mật khẩu?
              </Link>
            </div>
            {error && <div className="notice bad animate-pop-in">{error}</div>}
            <button className="btn lg block btn-glow" style={{ marginTop: 4 }}>
              Đăng nhập
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<Loading />}><LoginForm /></Suspense>;
}

