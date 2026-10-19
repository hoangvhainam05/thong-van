"use client";

// Biểu đồ cột đơn giản: một chuỗi số liệu, cột cuối (hôm nay) tô màu nhấn.
export default function Bars({ data, format = (v) => v, highlightLast = true, height = 180 }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="bars" style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}`).join(", ")}>
      {data.map((d, i) => (
        <div key={d.label + i} className="bar-col" title={`${d.label}: ${format(d.value)}`}>
          <span className="bar-val">{d.value ? format(d.value) : ""}</span>
          <div className={`bar ${highlightLast && i === data.length - 1 ? "today" : ""}`} style={{ height: `${(d.value / max) * 75}%`, background: d.color }} />
          <span className="bar-label">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
