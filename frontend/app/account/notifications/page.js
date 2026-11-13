"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, loadToken } from "@/lib/api";
import { ago } from "@/lib/format";
import { Empty, Loading } from "@/components/ui";
import { playTap } from "@/lib/audio-juice";
import { Bell, CheckCheck, ShieldAlert, Sparkles } from "lucide-react";

export default function Notifications() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      const result = await api("/api/account/notifications", { token: loadToken() });
      setData(result);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 30000);
    return () => clearInterval(timer);
  }, []);

  async function action(path, method, body) {
    setBusy(true);
    try {
      const result = await api(path, { method, body, token: loadToken() });
      setData(result);
      setError("");
      window.dispatchEvent(new Event("thongvan-notifications"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) return <Loading message="Đang tải thông báo…" />;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Thông báo đơn hàng & dịch vụ</h1>
        <p className="muted" style={{ marginTop: 4 }}>
          Cập nhật tức thời tiến độ giao hàng, xuất kho và lịch hẹn bảo dưỡng thiết bị.
        </p>
      </div>

      {error && <div className="notice bad animate-pop-in">{error}</div>}

      {data && (
        <>
          <section className="panel panel-pad stack-sm" style={{ background: "var(--paper)" }}>
            <div className="row between" style={{ alignItems: "center" }}>
              <div>
                <b>Thông báo trạng thái trên hệ thống</b>
                <p className="small muted" style={{ marginTop: 2 }}>
                  {data.enabled
                    ? "Đang nhận thông báo về tiến độ đơn hàng và bảo dưỡng trực tiếp trên website."
                    : "Bật để nhận thông báo tức thời khi đơn hàng thay đổi trạng thái hoặc xe sắp tới."}
                </p>
              </div>
              <button
                className={`btn sm ${data.enabled ? "secondary" : "btn-glow"}`}
                disabled={busy}
                onClick={() => {
                  playTap(700, 0.03);
                  action("/api/account/notification-consent", "PATCH", { enabled: !data.enabled });
                }}
              >
                {data.enabled ? "Tắt thông báo" : "Đồng ý nhận thông báo"}
              </button>
            </div>
          </section>

          {data.enabled && (
            <>
              {data.unread > 0 && (
                <div className="row end">
                  <button
                    className="btn secondary sm row"
                    style={{ gap: 6 }}
                    disabled={busy}
                    onClick={() => {
                      playTap(700, 0.03);
                      action("/api/account/notifications/read", "POST");
                    }}
                  >
                    <CheckCheck size={15} />
                    <span>Đánh dấu tất cả đã đọc</span>
                  </button>
                </div>
              )}

              {!data.notifications.length ? (
                <div className="panel">
                  <Empty title="Chưa có thông báo nào">
                    Các thông báo cập nhật về lộ trình xe và đơn hàng sẽ xuất hiện tại đây.
                  </Empty>
                </div>
              ) : (
                <div className="panel" style={{ overflow: "hidden" }}>
                  {data.notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={n.kind === "MAINTENANCE" ? "/account/warranties" : `/account/orders/${n.order_id}`}
                      className="row"
                      style={{
                        padding: "16px 20px",
                        borderBottom: "1px solid var(--line-soft)",
                        alignItems: "flex-start",
                        gap: 14,
                        background: n.read ? undefined : "var(--signal-soft)",
                        transition: "background var(--duration-fast)",
                      }}
                      onClick={() => playTap(700, 0.03)}
                    >
                      <span
                        className="notification-icon"
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          background: n.read ? "var(--ground)" : "rgba(245, 158, 11, 0.2)",
                          color: n.read ? "var(--muted)" : "var(--signal-deep)",
                          display: "grid",
                          placeItems: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Bell size={17} />
                      </span>
                      <div className="grow">
                        <div className="row" style={{ gap: 8, alignItems: "center" }}>
                          <b className="strong">{n.title}</b>
                          {n.code && <span className="small muted">· {n.code}</span>}
                          {!n.read && <span className="live-dot" style={{ width: 6, height: 6 }} />}
                        </div>
                        {n.body && <div className="small muted" style={{ marginTop: 4, lineHeight: 1.5 }}>{n.body}</div>}
                      </div>
                      <span className="tiny faint nowrap">{ago(n.at)}</span>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
