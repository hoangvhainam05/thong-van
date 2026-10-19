"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { homeFor, PERMISSION_LABEL, ROLES } from "@/lib/rbac";
import { Loading } from "./ui";

// Chặn trang theo quyền. Chưa đăng nhập -> chuyển tới /login?next=...
// Đã đăng nhập nhưng thiếu quyền -> màn hình 403 (không chuyển hướng, để người dùng biết vì sao).
export function RequirePerm({ perm, anyOf, children }) {
  const store = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const needLogin = store.ready && !store.user;

  useEffect(() => {
    if (needLogin) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [needLogin, pathname, router]);

  if (!store.ready || needLogin) return <Loading />;
  const perms = anyOf || [perm];
  if (!perms.some((p) => store.can(p))) return <Forbidden perm={perms[0]} />;
  return children;
}

export function Can({ perm, children, fallback = null }) {
  const store = useStore();
  if (!store.ready) return fallback;
  return store.can(perm) ? children : fallback;
}

export function Forbidden({ perm }) {
  const { user, state } = useStore();
  return (
    <div className="forbidden">
      <div className="sign" aria-hidden="true" />
      <h1>Bạn không có quyền vào trang này</h1>
      <p>
        Tài khoản <b>{user?.name}</b> ({ROLES[user?.role]?.label}) chưa được cấp quyền
        “{PERMISSION_LABEL[perm] || perm}”. Liên hệ quản trị viên nếu bạn cần quyền này.
      </p>
      <div className="row" style={{ justifyContent: "center", marginTop: 20 }}>
        <Link className="btn" href={homeFor(state.roleMatrix, user?.role)}>Về trang của tôi</Link>
      </div>
    </div>
  );
}
