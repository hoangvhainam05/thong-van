"use client";

import { dateTime } from "@/lib/format";

const FLOW = [
  ["PENDING", "Đã đặt hàng"],
  ["CONFIRMED", "Đã xác nhận"],
  ["READY", "Đã chuẩn bị hàng"],
  ["SCHEDULED", "Đã xếp lịch giao"],
  ["OUT_FOR_DELIVERY", "Đang giao"],
  ["DELIVERED", "Đã giao"],
];

export default function OrderTimeline({ order, showActor }) {
  const at = (st) => [...order.history].reverse().find((h) => h.status === st);
  if (order.status === "CANCELLED" || order.status === "FAILED") {
    return (
      <ul className="timeline">
        {order.history.map((h, i) => (
          <li key={i} className={h.status === "CANCELLED" || h.status === "FAILED" ? "failed" : "done"}>
            <span className="dot" />
            <div className="t-title">{FLOW.find((f) => f[0] === h.status)?.[1] || (h.status === "FAILED" ? "Giao không thành công" : "Đã huỷ")}</div>
            <div className="t-meta">{dateTime(h.at)}{showActor && h.by ? ` · ${h.by}` : ""}{h.note ? ` · ${h.note}` : ""}</div>
          </li>
        ))}
      </ul>
    );
  }
  const idx = FLOW.findIndex((f) => f[0] === order.status);
  return (
    <ul className="timeline">
      {FLOW.map(([st, label], i) => {
        const h = at(st);
        const cls = i < idx ? "done" : i === idx ? (st === "DELIVERED" ? "done" : "current") : "todo";
        return (
          <li key={st} className={cls}>
            <span className="dot" />
            <div className="t-title">{label}</div>
            {h && <div className="t-meta">{dateTime(h.at)}{showActor && h.by ? ` · ${h.by}` : ""}{h.note ? ` · ${h.note}` : ""}</div>}
          </li>
        );
      })}
    </ul>
  );
}
