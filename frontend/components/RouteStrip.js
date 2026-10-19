"use client";

// Dải lộ trình: con đường từ kho qua các điểm giao, điểm của khách tô vàng.
// Chỉ nhận trạng thái ẩn danh (đã giao / đang ở / chưa tới), không có thông tin đơn khác.
export default function RouteStrip({ strip, compact }) {
  const nodes = [{ depot: true }, ...strip];
  const doneCount = strip.filter((s) => s.done).length;
  const hereIdx = strip.findIndex((s) => s.here);
  const truckAt = hereIdx >= 0 ? hereIdx + 1 : doneCount;
  const frac = nodes.length > 1 ? truckAt / (nodes.length - 1) : 0;
  return (
    <div className="strip">
      <div className="strip-road" role="img" aria-label={`Lộ trình ${strip.length} điểm giao, đã xong ${doneCount} điểm`}>
        <span className="strip-truck" style={{ left: `calc(24px + (100% - 48px) * ${frac})` }} aria-hidden="true">🚚</span>
        {nodes.map((n, i) =>
          n.depot ? (
            <span key="depot" className="strip-node depot" title="Kho">K</span>
          ) : (
            <span key={n.seq} className={`strip-node ${n.me ? "me" : n.done ? "done" : n.here ? "here" : ""}`}>
              {n.me ? "Bạn" : n.done ? "✓" : n.seq}
            </span>
          )
        )}
      </div>
      {!compact && (
        <div className="strip-legend">
          <span><i style={{ background: "#3c7d63" }} />Đã giao</span>
          <span><i style={{ background: "#44556b" }} />Chưa tới</span>
          <span><i style={{ background: "var(--signal)" }} />Điểm của bạn</span>
        </div>
      )}
    </div>
  );
}
