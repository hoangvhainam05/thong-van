"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { api, loadToken } from "@/lib/api";
import { useStore } from "@/lib/store";
import { RequirePerm } from "./Guard";
import { playTap } from "@/lib/audio-juice";
import { Package, Bell, ShieldCheck, User } from "lucide-react";

export default function AccountShell({ children }) {
  return (
    <RequirePerm perm="order.track_own">
      <Inner>{children}</Inner>
    </RequirePerm>
  );
}

function Inner({ children }) {
  const pathname = usePathname();
  const { can } = useStore();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!can("notification.own")) return;
    let active = true;
    async function refresh() {
      try {
        const result = await api("/api/account/notifications", { token: loadToken() });
        if (active) setUnread(result.unread);
      } catch {
        if (active) setUnread(0);
      }
    }
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("thongvan-notifications", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("thongvan-notifications", refresh);
    };
  }, [can]);

  const items = [
    { href: "/account/orders", label: "Đơn hàng của tôi", icon: Package, count: 0 },
    ...(can("notification.own")
      ? [{ href: "/account/notifications", label: "Thông báo", icon: Bell, count: unread }]
      : []),
    { href: "/account/warranties", label: "Bảo hành & bảo dưỡng", icon: ShieldCheck, count: 0 },
    { href: "/account/profile", label: "Hồ sơ tài khoản", icon: User, count: 0 },
  ];

  return (
    <div className="account-layout animate-pop-in">
      <nav className="account-nav" aria-label="Menu tài khoản">
        {items.map(({ href, label, icon: IconComponent, count }) => {
          const on = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`row ${on ? "on" : ""}`}
              style={{ gap: 8, alignItems: "center" }}
              onClick={() => playTap(700, 0.03)}
            >
              <IconComponent size={16} />
              <span>{label}</span>
              {count > 0 && <span className="badge move plain">{count}</span>}
            </Link>
          );
        })}
      </nav>
      <div className="account-content">{children}</div>
    </div>
  );
}
