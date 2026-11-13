"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { dateLabel, ymd } from "@/lib/format";
import { RequirePerm } from "./Guard";
import { Avatar, RoleChip } from "./ui";
import SoundToggle from "./SoundToggle";
import { playTap } from "@/lib/audio-juice";
import {
  LayoutDashboard,
  ShoppingBag,
  Store,
  Truck,
  Package,
  Users,
  Warehouse,
  FileBarChart2,
  UserCheck,
  ShieldCheck,
  Settings,
  History,
  Clock,
  ExternalLink,
  LogOut,
  Menu,
} from "lucide-react";

export const NAV = [
  {
    group: "Vận hành",
    items: [
      { href: "/admin", label: "Tổng quan", perm: "dashboard.view", exact: true, icon: LayoutDashboard },
      { href: "/admin/orders", label: "Đơn hàng", perm: "order.view_all", icon: ShoppingBag },
      { href: "/admin/counter-orders", label: "Đơn tại quầy", perm: "order.create_counter", icon: Store },
      { href: "/admin/dispatch", label: "Điều phối giao hàng", perm: "dispatch.view", icon: Truck },
      { href: "/admin/products", label: "Sản phẩm", perm: "product.manage", icon: Package },
      { href: "/admin/customers", label: "Khách hàng", perm: "customer.view", icon: Users },
      { href: "/admin/warehouse", label: "Kho xuất hàng", perm: "fleet.manage", icon: Warehouse },
      { href: "/admin/fleet", label: "Tài xế và xe", perm: "fleet.manage", icon: Truck },
      { href: "/admin/reports", label: "Báo cáo", perm: "report.view", icon: FileBarChart2 },
    ],
  },
  {
    group: "Hệ thống",
    items: [
      { href: "/admin/users", label: "Tài khoản", perm: "user.manage", icon: UserCheck },
      { href: "/admin/roles", label: "Phân quyền", perm: "role.manage", icon: ShieldCheck },
      { href: "/admin/settings", label: "Cài đặt", perm: "settings.manage", icon: Settings },
      { href: "/admin/audit", label: "Nhật ký thao tác", perm: "audit.view", icon: History },
    ],
  },
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
  const [clock, setClock] = useState("");

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleTimeString("vi-VN"));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="admin">
      <aside className={`sidebar ${open ? "open" : ""}`} onClick={() => setOpen(false)}>
        <Link href="/admin" className="logo" onClick={() => playTap(800, 0.03)}>
          <img className="logo-image" src="/brand-logo.png" alt="Thông Vân — Quản trị" />
        </Link>
        {NAV.map((g) => {
          const items = g.items.filter((it) => can(it.perm));
          if (!items.length) return null;
          return (
            <div key={g.group} className="nav-group-wrap">
              <div className="group">{g.group}</div>
              {items.map((it) => {
                const on = it.exact ? pathname === it.href : pathname.startsWith(it.href);
                const n = it.count ? it.count(state) : 0;
                const IconComponent = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    className={on ? "on" : ""}
                    aria-current={on ? "page" : undefined}
                    onClick={() => playTap(700, 0.03)}
                  >
                    {IconComponent && <IconComponent size={16} className="nav-icon" />}
                    <span>{it.label}</span>
                    {n > 0 && <span className="count">{n}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
        <div className="me">
          <div className="user-avatar-wrap">
            <Avatar name={user.name} />
            <span className="user-online-dot" />
          </div>
          <div className="grow">
            <div className="truncate" style={{ color: "#fff", fontWeight: 600, fontSize: 14 }} title={user.name}>
              {user.name}
            </div>
            <div className="tiny truncate" style={{ color: "#94a3b8" }} title={user.email}>
              {user.email}
            </div>
          </div>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-top">
          <button
            className="btn ghost menu-toggle"
            onClick={() => {
              playTap(700, 0.03);
              setOpen(true);
            }}
            aria-label="Mở menu"
          >
            <Menu size={20} />
          </button>

          <div className="row hide-sm" style={{ gap: 10, alignItems: "center" }}>
            <span className="small muted">
              {dateLabel(ymd())}, {new Date().toLocaleDateString("vi-VN", { weekday: "long", day: "numeric", month: "numeric" })}
            </span>
            {clock && (
              <span className="admin-clock-badge row" style={{ gap: 5, alignItems: "center" }}>
                <Clock size={13} color="var(--signal)" />
                <span>{clock}</span>
              </span>
            )}
          </div>

          <span className="grow" />

          <RoleChip role={user.role} />

          <SoundToggle />

          <Link
            href="/"
            className="btn ghost sm hide-sm row"
            style={{ gap: 6 }}
            onClick={() => playTap(700, 0.03)}
          >
            <span>Cửa hàng</span>
            <ExternalLink size={13} />
          </Link>

          <button
            className="btn secondary sm row"
            style={{ gap: 6 }}
            onClick={() => {
              playTap(600, 0.03);
              actions.logout();
              router.push("/login");
            }}
          >
            <LogOut size={13} />
            <span>Đăng xuất</span>
          </button>
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
