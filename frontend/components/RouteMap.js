"use client";

// Sơ đồ tuyến vẽ bằng SVG từ toạ độ thật (chiếu phẳng), không cần bản đồ nền.
// Khi tích hợp Map API có thể thay bằng Leaflet/MapLibre mà giữ nguyên dữ liệu đầu vào.

export const ROUTE_COLORS = ["#1b4f8c", "#7a4fd1", "#16805a", "#d0661a", "#0f8b9c", "#b03a6a"];

export default function RouteMap({ depot, routes = [], loose = [], height = 460, focusId }) {
  const pts = [depot, ...routes.flatMap((r) => r.stops), ...loose].filter((p) => p && p.lat != null);
  if (pts.length < 1) return null;
  const W = 800, H = height, pad = 36;
  const lat0 = depot.lat * (Math.PI / 180);
  const xs = pts.map((p) => p.lng * Math.cos(lat0));
  const ys = pts.map((p) => p.lat);
  let [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const spanX = Math.max(maxX - minX, 0.01), spanY = Math.max(maxY - minY, 0.01);
  const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
  const offX = (W - spanX * scale) / 2, offY = (H - spanY * scale) / 2;
  const P = (p) => [offX + (p.lng * Math.cos(lat0) - minX) * scale, H - (offY + (p.lat - minY) * scale)];
  const d0 = P(depot);

  // lưới nền ~1 km
  const kmPx = scale / 111;
  const grid = [];
  if (kmPx > 6) {
    for (let x = d0[0] % (kmPx * 2); x < W; x += kmPx * 2) grid.push(<line key={`x${x}`} x1={x} y1={0} x2={x} y2={H} />);
    for (let y = d0[1] % (kmPx * 2); y < H; y += kmPx * 2) grid.push(<line key={`y${y}`} x1={0} y1={y} x2={W} y2={y} />);
  }

  return (
    <div className="map-box">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sơ đồ tuyến giao hàng">
        <g stroke="#e1e7ee" strokeWidth="1">{grid}</g>
        {routes.map((r, ri) => {
          const color = r.color || ROUTE_COLORS[ri % ROUTE_COLORS.length];
          const dim = focusId != null && focusId !== r.id;
          const path = [d0, ...r.stops.map(P), d0].map((p) => p.join(",")).join(" ");
          return (
            <g key={r.id} opacity={dim ? 0.18 : 1}>
              <polyline points={path} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="round" strokeDasharray={r.status === "DRAFT" ? "8 6" : undefined} />
              {r.stops.map((s) => {
                const [x, y] = P(s);
                const fill = s.state === "done" ? "#9fb0c3" : s.state === "here" ? "#f2b100" : color;
                return (
                  <g key={s.seq}>
                    <circle cx={x} cy={y} r="11" fill={fill} stroke="#fff" strokeWidth="2" />
                    <text x={x} y={y + 4} textAnchor="middle" fontSize="11" fontWeight="700" fill={s.state === "here" ? "#142236" : "#fff"}>{s.seq}</text>
                    {s.label && <title>{s.label}</title>}
                  </g>
                );
              })}
            </g>
          );
        })}
        {loose.map((p, i) => {
          const [x, y] = P(p);
          return (
            <g key={`l${i}`}>
              <circle cx={x} cy={y} r="7" fill="#fff" stroke="#5a6a7e" strokeWidth="2" strokeDasharray="3 2" />
              {p.label && <title>{p.label}</title>}
            </g>
          );
        })}
        <rect x={d0[0] - 12} y={d0[1] - 12} width="24" height="24" rx="5" fill="#142236" />
        <text x={d0[0]} y={d0[1] + 4} textAnchor="middle" fontSize="11" fontWeight="800" fill="#f2b100">K</text>
        {kmPx > 6 && (
          <g transform={`translate(${W - 20 - kmPx * 2}, ${H - 18})`}>
            <line x1="0" y1="0" x2={kmPx * 2} y2="0" stroke="#5a6a7e" strokeWidth="2" />
            <text x={kmPx} y="-6" textAnchor="middle" fontSize="11" fill="#5a6a7e">2 km</text>
          </g>
        )}
      </svg>
      {(routes.length > 0 || loose.length > 0) && (
        <div className="map-legend">
          <span>■ Kho</span>
          {routes.map((r, ri) => (
            <span key={r.id} style={{ color: r.color || ROUTE_COLORS[ri % ROUTE_COLORS.length], fontWeight: 600 }}>— {r.name}</span>
          ))}
          {loose.length > 0 && <span>○ Chưa xếp tuyến</span>}
        </div>
      )}
    </div>
  );
}
