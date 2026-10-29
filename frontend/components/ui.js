"use client";

import { useEffect } from "react";
import { ORDER_STATUS, ROUTE_STATUS } from "@/lib/store";
import { initials } from "@/lib/format";
import { ROLES } from "@/lib/rbac";

export function OrderBadge({ status }) {
  const s = ORDER_STATUS[status] || { label: status, tone: "" };
  return <span className={`badge ${s.tone}`}>{s.label}</span>;
}

export function RouteBadge({ status }) {
  const s = ROUTE_STATUS[status];
  return <span className={`badge ${s.tone}`} title={s.hint}>{s.label}</span>;
}

export function RoleChip({ role }) {
  return <span className={`role-chip ${role}`}>{ROLES[role]?.label || role}</span>;
}

export function Avatar({ name }) {
  return <span className="avatar" aria-hidden="true">{initials(name)}</span>;
}

export function Kpi({ label, value, delta, up, accent }) {
  return (
    <div className={`kpi ${accent ? "accent" : ""}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta && <div className={`delta ${up ? "up" : ""}`}>{delta}</div>}
    </div>
  );
}

export function Empty({ title, children, action }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && (title === "Chọn vị trí giao hàng" || !document.querySelector(".location-map"))) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? "wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Đóng">✕</button>
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
        <button key={it.value} role="tab" aria-selected={value === it.value} onClick={() => onChange(it.value)}>
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
        <button key={it.value} aria-pressed={value === it.value} onClick={() => onChange(it.value)}>{it.label}</button>
      ))}
    </div>
  );
}

export function Loading() {
  return <div className="loading-screen">Đang tải dữ liệu…</div>;
}

export function Toasts({ items }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => <div key={t.id} className={`toast ${t.tone}`}>{t.message}</div>)}
    </div>
  );
}
