"use client";

import Link from "next/link";
import { useState } from "react";
import { queueInfo, useStore } from "@/lib/store";
import { dateLabel, hm, vnd } from "@/lib/format";
import { Empty, OrderBadge, Tabs } from "@/components/ui";

const GROUPS = {
  active: ["PENDING", "CONFIRMED", "READY", "SCHEDULED", "OUT_FOR_DELIVERY"],
  done: ["DELIVERED"],
  other: ["CANCELLED", "FAILED"],
};

export default function MyOrders() {
  const { state, user } = useStore();
  const [tab, setTab] = useState("active");
  const mine = state.orders.filter((o) => o.customerId === user.customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const list = mine.filter((o) => GROUPS[tab].includes(o.status));

  return (
    <div className="stack">
      <h1>Đơn hàng của tôi</h1>
      <Tabs value={tab} onChange={setTab} items={[
        { value: "active", label: "Đang xử lý", count: mine.filter((o) => GROUPS.active.includes(o.status)).length },
        { value: "done", label: "Đã giao", count: mine.filter((o) => GROUPS.done.includes(o.status)).length },
        { value: "other", label: "Huỷ hoặc chưa giao được", count: mine.filter((o) => GROUPS.other.includes(o.status)).length },
      ]} />
      {list.length === 0 ? (
        <div className="panel"><Empty title="Chưa có đơn nào ở đây" action={<Link className="btn" href="/products">Mua sắm</Link>} /></div>
      ) : (
        list.map((o) => {
          const q = queueInfo(state, o);
          return (
            <Link key={o.id} href={`/account/orders/${o.id}`} className="panel panel-pad stack-sm" style={{ display: "flex" }}>
              <div className="row between">
                <div className="row"><b>{o.code}</b><OrderBadge status={o.status} /></div>
                <span className="price">{vnd(o.total)}</span>
              </div>
              <div className="small muted">{o.items.map((i) => i.name).join(", ")}</div>
              <div className="small">
                Giao {dateLabel(o.deliveryDate).toLowerCase()}, khung giờ {o.window.start}–{o.window.end}
                {q && !q.done && o.status !== "DELIVERED" && (
                  <span style={{ color: "var(--move)", fontWeight: 600 }}>
                    {" "}· {q.route.status === "IN_PROGRESS" ? `còn ${q.before} điểm trước bạn` : `điểm thứ ${q.position}`}, dự kiến {hm(q.etaStart)}–{hm(q.etaEnd)}
                  </span>
                )}
              </div>
            </Link>
          );
        })
      )}
    </div>
  );
}
