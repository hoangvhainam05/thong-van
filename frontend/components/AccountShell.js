"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStore } from "@/lib/store";
import { RequirePerm } from "./Guard";

export default function AccountShell({ children }) {
  return (
    <RequirePerm perm="order.track_own">
      <Inner>{children}</Inner>
    </RequirePerm>
  );
}

function Inner({ children }) {
  const pathname = usePathname();
  const { state, user } = useStore();
  const unread = state.notifications.filter((n) => n.customerId === user.customerId && !n.read).length;
  const active = state.orders.filter((o) => o.customerId === user.customerId && ["SCHEDULED", "OUT_FOR_DELIVERY"].includes(o.status)).length;
  const items = [
    ["/account/orders", "Đơn hàng", active],
    ["/account/notifications", "Thông báo", unread],
    ["/account/profile", "Tài khoản và địa chỉ", 0],
  ];
  return (
    <div className="account-layout">
      <nav className="account-nav" aria-label="Tài khoản">
        {items.map(([href, label, n]) => (
          <Link key={href} href={href} className={pathname.startsWith(href) ? "on" : ""}>
            {label}{n > 0 && <span className="badge move plain">{n}</span>}
          </Link>
        ))}
      </nav>
      <div>{children}</div>
    </div>
  );
}
