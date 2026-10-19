"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { ago } from "@/lib/format";
import { Empty } from "@/components/ui";

export default function Notifications() {
  const { state, user, actions } = useStore();
  const list = state.notifications.filter((n) => n.customerId === user.customerId).sort((a, b) => b.at.localeCompare(a.at));
  const unreadIds = list.filter((n) => !n.read).map((n) => n.id);

  // đánh dấu đã đọc sau khi mở trang một lúc
  useEffect(() => {
    if (!unreadIds.length) return;
    const t = setTimeout(() => actions.markNotificationsRead(), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadIds.length]);

  return (
    <div className="stack">
      <h1>Thông báo</h1>
      {list.length === 0 ? (
        <div className="panel"><Empty title="Chưa có thông báo">Thông báo về đơn hàng sẽ xuất hiện ở đây.</Empty></div>
      ) : (
        <div className="panel">
          {list.map((n) => (
            <Link key={n.id} href={`/account/orders/${n.orderId}`} className="row" style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)", alignItems: "flex-start", background: n.read ? undefined : "var(--signal-soft)" }}>
              <div className="grow">
                <div className="strong">{n.title}</div>
                <div className="small muted">{n.body}</div>
              </div>
              <span className="tiny faint nowrap">{ago(n.at)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
