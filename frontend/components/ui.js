"use client";

import { useEffect } from "react";
import { ORDER_STATUS, ROUTE_STATUS } from "@/lib/store";
import { initials } from "@/lib/format";
import { ROLES } from "@/lib/rbac";
import { playTap } from "@/lib/audio-juice";

export function OrderBadge({ status }) {
  const s = ORDER_STATUS[status] || { label: status, tone: "" };
  const isLive = status === "OUT_FOR_DELIVERY";
  return (
    <span className={`badge ${s.tone} ${isLive ? "live-beacon" : ""}`}>
      {isLive && <span className="live-dot" aria-hidden="true" />}
      {s.label}
    </span>
  );
}

export function RouteBadge({ status }) {
  const s = ROUTE_STATUS[status] || { label: status, tone: "" };
  const isLive = status === "IN_PROGRESS";
  return (
    <span className={`badge ${s.tone} ${isLive ? "live-beacon" : ""}`} title={s.hint}>
      {isLive && <span className="live-dot" aria-hidden="true" />}
      {s.label}
    </span>
  );
}

export function RoleChip({ role }) {
  return <span className={`role-chip ${role}`}>{ROLES[role]?.label || role}</span>;
}

export function Avatar({ name }) {
  return <span className="avatar" aria-hidden="true">{initials(name)}</span>;
}

export function Kpi({ label, value, delta, up, accent, icon }) {
  return (
    <div className={`kpi ${accent ? "accent" : ""}`}>
      <div className="row between" style={{ alignItems: "flex-start" }}>
        <div className="label">{label}</div>
        {icon && <span className="kpi-icon" aria-hidden="true">{icon}</span>}
      </div>
      <div className="value">{value}</div>
      {delta && <div className={`delta ${up ? "up" : ""}`}>{delta}</div>}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <div className="empty-icon-wrap" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </div>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && (title === "Chọn vị trí giao hàng" || !document.querySelector(".location-map"))) {
        playTap(600, 0.03);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, title]);

  return (
    <div className="overlay" onMouseDown={(e) => {
      if (e.target === e.currentTarget) {
        playTap(600, 0.03);
        onClose();
      }
    }}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn modal-close-btn" onClick={() => { playTap(600, 0.03); onClose(); }} aria-label="Đóng">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, full }) {
  return (
    <label className={`field ${full ? "full" : ""}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Tabs({ value, onChange, items }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => {
            playTap(750, 0.03);
            onChange(it.value);
          }}
        >
          {it.label}
          {it.count != null && <span className="count">{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Seg({ value, onChange, items }) {
  return (
    <div className="seg">
      {items.map((it) => (
        <button
          key={it.value}
          aria-pressed={value === it.value}
          onClick={() => {
            playTap(700, 0.03);
            onChange(it.value);
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

export function Loading({ message = "Đang tải dữ liệu…" }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="spinner-glow-wrap" aria-hidden="true">
        <div className="spinner" />
        <div className="spinner-core" />
      </div>
      <span>{message}</span>
    </div>
  );
}

export function Toasts({ items }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.tone}`}>
          <span className="toast-icon" aria-hidden="true">{t.tone === "bad" ? "✕" : "✓"}</span>
          <span className="toast-text">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
