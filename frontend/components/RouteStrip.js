"use client";

import { playTap } from "@/lib/audio-juice";

// Dải lộ trình nâng cấp với hiệu ứng ánh sáng, radar xe tải và đường chuyển động
export default function RouteStrip({ strip, compact }) {
  const nodes = [{ depot: true }, ...strip];
  const doneCount = strip.filter((s) => s.done).length;
  const hereIdx = strip.findIndex((s) => s.here);
  const truckAt = hereIdx >= 0 ? hereIdx + 1 : doneCount;
  const frac = nodes.length > 1 ? truckAt / (nodes.length - 1) : 0;
  const progressPercent = Math.min(100, Math.max(0, frac * 100));

  return (
    <div className="strip modern-strip">
      <div
        className="strip-road modern-strip-road"
        role="img"
        aria-label={`Lộ trình ${strip.length} điểm giao, đã xong ${doneCount} điểm`}
      >
        {/* Animated Active Progress Fill */}
        <div
          className="strip-progress-fill"
          style={{ width: `calc(24px + (100% - 48px) * ${frac})` }}
          aria-hidden="true"
        />

        {/* Animated 3D/Vector Truck Icon with glowing beam */}
        <div
          className="strip-truck-box"
          style={{ left: `calc(24px + (100% - 48px) * ${frac})` }}
          aria-hidden="true"
        >
          <span className="strip-truck-pulse" />
          <div className="strip-truck-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
        </div>

        {/* Waypoint Nodes */}
        {nodes.map((n, i) =>
          n.depot ? (
            <span
              key="depot"
              className="strip-node depot"
              title="Tổng kho phân loại Tân Bình"
              onClick={() => playTap(600, 0.04)}
            >
              🏢
            </span>
          ) : (
            <span
              key={n.seq}
              className={`strip-node ${n.me ? "me" : n.done ? "done" : n.here ? "here" : ""}`}
              title={n.me ? "Điểm giao của bạn" : n.done ? `Điểm #${n.seq} (Đã giao)` : n.here ? `Điểm #${n.seq} (Xe đang giao)` : `Điểm #${n.seq}`}
              onClick={() => playTap(n.me ? 1100 : 750, 0.04)}
            >
              {n.me ? "Bạn" : n.done ? "✓" : n.seq}
              {(n.here || n.me) && <span className="strip-node-ping" />}
            </span>
          )
        )}
      </div>

      {!compact && (
        <div className="strip-legend modern-strip-legend">
          <span><i style={{ background: "var(--go)" }} />Đã giao ({doneCount}/{strip.length})</span>
          <span><i style={{ background: "var(--signal)" }} />Điểm của bạn</span>
          <span><i style={{ background: "#475569" }} />Chưa tới</span>
        </div>
      )}
    </div>
  );
}
