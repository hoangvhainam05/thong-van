"use client";

import { useState } from "react";
import { dayStats, useStore } from "@/lib/store";
import { addDays, num, shortDate, vndShort, ymd } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import Bars from "@/components/Bars";
import { Kpi, Seg } from "@/components/ui";

function Reports() {
  const { state } = useStore();
  const [range, setRange] = useState(14);
  const today = ymd();
  const days = Array.from({ length: range }, (_, i) => addDays(today, -range + i)); // không tính hôm nay (chưa xong)
  const stats = days.map((d) => ({ d, ...dayStats(state, d) }));
  const sum = (k) => stats.reduce((s, x) => s + (x[k] || 0), 0);
  const completed = sum("completed");
  const onTime = stats.reduce((s, x) => s + (x.onTimeRate || 0) * x.completed, 0);
  const inRange = state.orders.filter((o) => o.deliveryDate >= days[0] && o.deliveryDate < today);
  const failReasons = Object.entries(inRange.filter((o) => o.status === "FAILED").reduce((m, o) => ({ ...m, [o.failReason]: (m[o.failReason] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const byDistrict = Object.entries(inRange.reduce((m, o) => ({ ...m, [o.district || "Khác"]: (m[o.district || "Khác"] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1]);
  const productSales = {};
  inRange.filter((o) => o.status === "DELIVERED").forEach((o) => o.items.forEach((it) => { productSales[it.name] = (productSales[it.name] || 0) + it.qty; }));
  const topProducts = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxD = Math.max(1, ...byDistrict.map((x) => x[1]));

  return (
    <>
      <PageHead title="Báo cáo giao hàng" sub="Hiệu quả tối ưu tuyến và chất lượng giao, không tính ngày hôm nay.">
        <Seg value={range} onChange={setRange} items={[{ value: 7, label: "7 ngày" }, { value: 14, label: "14 ngày" }, { value: 21, label: "21 ngày" }]} />
      </PageHead>
      <div className="kpis" style={{ marginBottom: 16 }}>
        <Kpi accent label="Đơn đã giao" value={num(sum("delivered"))} delta={`${sum("failed")} thất bại, ${sum("cancelled")} huỷ`} />
        <Kpi label="Doanh thu" value={vndShort(sum("revenue"))} />
        <Kpi label="Đúng khung giờ" value={`${completed ? Math.round((onTime / completed) * 100) : 0}%`} delta={`${completed} điểm giao`} up />
        <Kpi label="Tổng km chạy" value={`${num(sum("km"))} km`} delta={`Thủ công ước tính ${num(sum("baseline"))} km`} />
        <Kpi label="Km tiết kiệm" value={`${num(sum("savedKm"))} km`} delta={`${sum("baseline") ? Math.round((sum("savedKm") / sum("baseline")) * 100) : 0}% quãng đường`} up />
      </div>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <section className="panel">
          <div className="panel-head"><h3>Km tiết kiệm mỗi ngày</h3><span className="small muted">so với giao theo thứ tự đặt hàng</span></div>
          <div className="panel-body"><Bars highlightLast={false} data={stats.map((s) => ({ label: shortDate(s.d), value: Math.round(s.savedKm) }))} /></div>
        </section>
        <section className="panel">
          <div className="panel-head"><h3>Tỷ lệ đúng khung giờ</h3><span className="small muted">%</span></div>
          <div className="panel-body"><Bars highlightLast={false} data={stats.map((s) => ({ label: shortDate(s.d), value: s.onTimeRate != null ? Math.round(s.onTimeRate * 100) : 0, color: s.onTimeRate != null && s.onTimeRate < 0.85 ? "var(--move)" : "var(--go)" }))} /></div>
        </section>
      </div>
      <div className="grid-2">
        <section className="panel">
          <div className="panel-head"><h3>Đơn theo khu vực</h3></div>
          <div className="panel-body stack-sm">
            {byDistrict.map(([d, n]) => (
              <div key={d} className="row small" style={{ flexWrap: "nowrap" }}>
                <span style={{ width: 120 }}>{d}</span>
                <div className="grow progress" style={{ height: 10 }}><span style={{ width: `${(n / maxD) * 100}%`, background: "var(--road)" }} /></div>
                <span style={{ width: 30 }} className="right">{n}</span>
              </div>
            ))}
          </div>
        </section>
        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h3>Lý do giao thất bại</h3></div>
            <div className="panel-body stack-sm small">
              {failReasons.length === 0 && <span className="muted">Không có đơn giao thất bại.</span>}
              {failReasons.map(([r, n]) => <div key={r} className="row between"><span>{r}</span><b>{n}</b></div>)}
            </div>
          </section>
          <section className="panel">
            <div className="panel-head"><h3>Sản phẩm giao nhiều</h3></div>
            <div className="panel-body stack-sm small">
              {topProducts.map(([name, n]) => <div key={name} className="row between"><span className="grow">{name}</span><b>{n}</b></div>)}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

export default function ReportsPage() {
  return <RequirePerm perm="report.view"><Reports /></RequirePerm>;
}
