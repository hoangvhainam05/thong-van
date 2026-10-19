"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { dateLabel, ymd } from "@/lib/format";
import { RequirePerm } from "./Guard";
import { Avatar, RoleChip } from "./ui";

export const NAV = [
  { group: "Vận hành", items: [
    { href: "/admin", label: "Tổng quan", perm: "dashboard.view", exact: true },
    { href: "/admin/orders", label: "Đơn hàng", perm: "order.view_all", count: (s) => s.orders.filter((o) => o.status === "PENDING").length },
    { href: "/admin/dispatch", label: "Điều phối giao hàng", perm: "dispatch.view", count: (s) => s.orders.filter((o) => o.status === "READY" && o.deliveryDate === ymd()).length },
    { href: "/admin/products", label: "Sản phẩm", perm: "product.manage" },
    { href: "/admin/customers", label: "Khách hàng", perm: "customer.view" },
    { href: "/admin/fleet", label: "Tài xế và xe", perm: "fleet.manage" },
    { href: "/admin/reports", label: "Báo cáo", perm: "report.view" },
  ] },
  { group: "Hệ thống", items: [
    { href: "/admin/users", label: "Tài khoản", perm: "user.manage" },
    { href: "/admin/roles", label: "Phân quyền", perm: "role.manage" },
    { href: "/admin/settings", label: "Cài đặt", perm: "settings.manage" },
    { href: "/admin/audit", label: "Nhật ký thao tác", perm: "audit.view" },
  ] },
];

export default function AdminShell({ children }) {
  return (
    <RequirePerm perm="backoffice.access">
      <Frame>{children}</Frame>
    </RequirePerm>
  );
}

function Frame({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, user, can, actions } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="admin">
      <aside className={`sidebar ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
        <Link href="/admin" className="logo"><span className="logo-mark">TV</span>Thông Vân</Link>
        {NAV.map((g) => {
          const items = g.items.filter((it) => can(it.perm));
          if (!items.length) return null;
          return (
            <div key={g.group}>
              <div className="group">{g.group}</div>
              {items.map((it) => {
                const on = it.exact ? pathname === it.href : pathname.startsWith(it.href);
                const n = it.count ? it.count(state) : 0;
                return (
                  <Link key={it.href} href={it.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
                    {it.label}{n > 0 && <span className="count">{n}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
        <div className="me">
          <Avatar name={user.name} />
          <div className="grow">
            <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{user.name}</div>
            <div className="tiny">{user.email}</div>
          </div>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-top">
          <button className="btn ghost menu-toggle" onClick={() => setOpen(true)} aria-label="Mở menu">☰</button>
          <span className="small muted hide-sm">{dateLabel(ymd())}, {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric" })}</span>
          <span className="grow" />
          <RoleChip role={user.role} />
          <Link href="/" className="btn ghost sm hide-sm">Xem cửa hàng</Link>
          <button className="btn secondary sm" onClick={() => { actions.logout(); router.push("/login"); }}>Đăng xuất</button>
        </header>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="row">{children}</div>}
    </div>
  );
}
