"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, loadToken } from "@/lib/api";
import { useStore } from "@/lib/store";
import { vnd, ymd } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Kpi, Loading } from "@/components/ui";
import { playTap } from "@/lib/audio-juice";
import {
  ShoppingBag,
  Coins,
  Clock,
  Truck,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Activity,
} from "lucide-react";

function Dashboard() {
  const { user, can } = useStore();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    api(`/api/admin/dashboard?date=${ymd()}`, { token: loadToken() })
      .then((x) => {
        if (active) setData(x);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) return <div className="notice bad">{error}</div>;
  if (!data) return <Loading message="Đang tải dữ liệu tổng quan…" />;

  const t = data.totals;
  const todo = data.todo;

  const actions = [
    can("order.confirm") && todo.pending > 0 && [
      `${todo.pending} đơn chờ xác nhận`,
      "/admin/orders?status=PENDING",
      "Cần kiểm tra hàng tồn và xác nhận đơn mới",
    ],
    can("order.edit_location") && todo.missing_location > 0 && [
      `${todo.missing_location} đơn thiếu vị trí`,
      "/admin/orders?status=NOLOC",
      "Cần định vị tọa độ giao hàng để thuật toán xếp tuyến",
    ],
    can("route.optimize") && todo.ready_today > 0 && [
      `${todo.ready_today} đơn hôm nay chờ xếp tuyến`,
      "/admin/dispatch",
      "Đơn đã xác nhận sẵn sàng để chạy thuật toán điều phối",
    ],
    can("route.approve") && todo.drafts > 0 && [
      `${todo.drafts} tuyến nháp cần duyệt`,
      "/admin/dispatch",
      "Quản lý xem xét lộ trình và bấm duyệt tuyến",
    ],
    can("route.dispatch") && todo.locked > 0 && [
      `${todo.locked} tuyến đã chốt chờ xuất phát`,
      "/admin/dispatch",
      "Bàn giao hàng cho tài xế và bắt đầu chuyến giao",
    ],
  ].filter(Boolean);

  return (
    <div className="stack" style={{ gap: 24 }}>
      <PageHead
        title={`Chào ${user.name.split(" ").slice(-1)[0]}`}
        sub="Tình hình vận hành và điều phối giao hàng hôm nay từ dữ liệu thời gian thực."
      >
        <div className="row" style={{ gap: 8, alignItems: "center" }}>
          <span className="live-dot" />
          <span className="small muted">Hệ thống đồng bộ trực tuyến</span>
        </div>
      </PageHead>

      {/* KPI Cards Grid */}
      <div className="kpis">
        <Kpi
          accent
          label="Đơn theo ngày giao"
          value={t.orders}
          delta={`${t.delivered_orders} đã hoàn thành`}
          up={t.delivered_orders > 0}
          icon={<ShoppingBag size={20} color="#93c5fd" />}
        />
        <Kpi
          label="Giá trị đơn đã giao"
          value={vnd(t.revenue)}
          delta="Doanh số đơn hoàn tất hôm nay"
          icon={<Coins size={20} color="var(--signal)" />}
        />
        <Kpi
          label="Tỷ lệ đúng hẹn"
          value={t.on_time_rate == null ? "—" : `${Math.round(t.on_time_rate * 100)}%`}
          delta={`${t.timed} điểm giao có khung giờ`}
          up={t.on_time_rate >= 0.9}
          icon={<Clock size={20} color="var(--go)" />}
        />
        <Kpi
          label="Quãng đường kế hoạch"
          value={`${t.planned_km.toFixed(1)} km`}
          delta={`${t.routes} tuyến đã chốt lịch`}
          icon={<Truck size={20} color="var(--plan)" />}
        />
      </div>

      {/* Tasks / To-Do Panel */}
      <section className="panel">
        <div className="panel-head row between">
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <Activity size={18} color="var(--signal)" />
            <h3>Việc cần làm hôm nay</h3>
          </div>
          {actions.length > 0 && (
            <span className="badge move plain">{actions.length} nhiệm vụ</span>
          )}
        </div>
        <div className="panel-body stack-sm">
          {!actions.length ? (
            <div className="row" style={{ gap: 10, padding: "12px 0", color: "var(--go)" }}>
              <CheckCircle2 size={18} />
              <span className="small">Tuyệt vời! Không có việc tồn đọng trong phạm vi quyền của bạn.</span>
            </div>
          ) : (
            actions.map(([label, href, desc]) => (
              <div
                key={label}
                className="row between"
                style={{
                  padding: "14px 16px",
                  background: "var(--ground)",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--line-soft)",
                  transition: "all var(--duration-fast)",
                }}
              >
                <div className="stack" style={{ gap: 2 }}>
                  <div className="row" style={{ gap: 8, alignItems: "center" }}>
                    <AlertCircle size={16} color="var(--signal)" />
                    <b>{label}</b>
                  </div>
                  {desc && <span className="small muted">{desc}</span>}
                </div>
                <Link
                  className="btn secondary sm row"
                  style={{ gap: 4 }}
                  href={href}
                  onClick={() => playTap(750, 0.03)}
                >
                  <span>Xử lý</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default function AdminHome() {
  return (
    <RequirePerm perm="dashboard.view">
      <Dashboard />
    </RequirePerm>
  );
}
