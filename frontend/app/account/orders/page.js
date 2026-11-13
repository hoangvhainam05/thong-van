"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, loadToken } from "@/lib/api";
import { dateLabel, vnd } from "@/lib/format";
import { Empty, Loading, OrderBadge, Tabs } from "@/components/ui";
import { playTap } from "@/lib/audio-juice";
import { Package, Calendar, Clock, ChevronRight } from "lucide-react";

const GROUPS = {
  active: ["PENDING", "CONFIRMED", "READY", "SCHEDULED", "OUT_FOR_DELIVERY"],
  done: ["DELIVERED"],
  other: ["CANCELLED", "FAILED"],
};

export default function MyOrders() {
  const [tab, setTab] = useState("active");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      try {
        const data = await api("/api/account/orders", { token: loadToken() });
        if (mounted) {
          setOrders(data);
          setError("");
        }
      } catch (e) {
        if (mounted) setError(e.message);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  if (loading) return <Loading message="Đang tải danh sách đơn hàng…" />;

  const filteredOrders = orders.filter((o) => GROUPS[tab].includes(o.status));

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Đơn hàng của tôi</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Theo dõi trạng thái xử lý, thứ tự điểm giao và thời gian giao hàng dự kiến.
        </p>
      </div>

      {error && <div className="notice bad animate-pop-in">{error}</div>}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          {
            value: "active",
            label: "Đang xử lý",
            count: orders.filter((o) => GROUPS.active.includes(o.status)).length,
          },
          {
            value: "done",
            label: "Đã giao thành công",
            count: orders.filter((o) => GROUPS.done.includes(o.status)).length,
          },
          {
            value: "other",
            label: "Huỷ hoặc giao thất bại",
            count: orders.filter((o) => GROUPS.other.includes(o.status)).length,
          },
        ]}
      />

      {filteredOrders.length === 0 ? (
        <div className="panel">
          <Empty
            title="Chưa có đơn hàng nào ở mục này"
            action={
              <Link className="btn btn-glow" href="/products" onClick={() => playTap(800, 0.03)}>
                Khám phá sản phẩm
              </Link>
            }
          >
            Các đơn hàng sau khi đặt sẽ được cập nhật trạng thái liên tục tại đây.
          </Empty>
        </div>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {filteredOrders.map((o) => (
            <Link
              key={o.id}
              href={`/account/orders/${o.id}`}
              className="panel panel-pad stack-sm"
              style={{
                display: "flex",
                transition: "all var(--duration-fast) var(--ease)",
                boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
              }}
              onClick={() => playTap(700, 0.03)}
            >
              <div className="row between" style={{ alignItems: "center" }}>
                <div className="row" style={{ gap: 10, alignItems: "center" }}>
                  <b style={{ fontSize: 16 }}>{o.code}</b>
                  <OrderBadge status={o.status} />
                </div>
                <div className="row" style={{ gap: 8, alignItems: "center" }}>
                  <span className="price" style={{ fontSize: 18 }}>{vnd(o.total)}</span>
                  <ChevronRight size={16} color="var(--muted)" />
                </div>
              </div>

              <div className="small muted" style={{ lineHeight: 1.5 }}>
                {o.items.map((i) => `${i.name} × ${i.quantity}`).join(", ")}
              </div>

              <div className="row between small" style={{ paddingTop: 6, borderTop: "1px solid var(--line-soft)" }}>
                <span className="muted row" style={{ gap: 6, alignItems: "center" }}>
                  <Calendar size={14} color="var(--signal)" />
                  <span>Giao {dateLabel(o.delivery_date).toLowerCase()}</span>
                </span>
                <span className="muted row" style={{ gap: 6, alignItems: "center" }}>
                  <Clock size={14} color="var(--road)" />
                  <span>Khung giờ: {o.time_window}</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
