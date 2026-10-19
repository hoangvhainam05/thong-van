"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/mock/catalog";
import Art from "@/components/Art";
import ProductCard from "@/components/ProductCard";
import RouteStrip from "@/components/RouteStrip";
import { Loading } from "@/components/ui";

const SAMPLE_STRIP = [
  { seq: 1, done: true }, { seq: 2, done: true }, { seq: 3, here: true },
  { seq: 4, me: true }, { seq: 5 }, { seq: 6 },
];

export default function HomePage() {
  const { ready, state } = useStore();
  if (!ready) return <Loading />;
  const active = state.products.filter((p) => p.active);
  const deals = active.filter((p) => p.oldPrice).sort((a, b) => b.oldPrice - b.price - (a.oldPrice - a.price)).slice(0, 4);
  const best = [...active].sort((a, b) => b.sold - a.sold).slice(0, 8);

  return (
    <>
      <section className="hero">
        <div>
          <h1>Đặt hôm nay, biết chính xác lúc nào xe tới nhà</h1>
          <p className="lead">
            Thông Vân giao và lắp đặt điện máy tận nơi. Mỗi đơn có khung giờ dự kiến và cho bạn thấy
            còn bao nhiêu điểm giao trước mình, cập nhật theo từng điểm tài xế hoàn thành.
          </p>
          <div className="row" style={{ marginTop: 22 }}>
            <Link href="/products" className="btn lg">Xem sản phẩm</Link>
            <Link href="/track" className="btn lg secondary">Tra cứu đơn hàng</Link>
          </div>
        </div>
        <div className="hero-card">
          <div className="row between">
            <span className="small muted">Ví dụ: đơn máy giặt giao hôm nay</span>
            <span className="badge move">Đang giao</span>
          </div>
          <div style={{ margin: "14px 0 4px" }}>
            <div className="big">Còn 1 điểm</div>
            <div className="muted">trước bạn · dự kiến tới 10:40 – 11:35</div>
          </div>
          <RouteStrip strip={SAMPLE_STRIP} />
        </div>
      </section>

      <div className="section-head"><h2>Danh mục</h2></div>
      <div className="cat-row">
        {CATEGORIES.map((c) => (
          <Link key={c.id} href={`/products?cat=${c.id}`} className="cat-tile">
            <Art icon={c.icon} className="art" />
            {c.name}
          </Link>
        ))}
      </div>

      <div className="section-head">
        <h2>Đang giảm giá</h2>
        <Link href="/products?sort=sale" className="small strong" style={{ color: "var(--road)" }}>Xem tất cả</Link>
      </div>
      <div className="product-grid">{deals.map((p) => <ProductCard key={p.id} p={p} />)}</div>

      <div className="section-head"><h2>Bán chạy</h2></div>
      <div className="product-grid">{best.map((p) => <ProductCard key={p.id} p={p} />)}</div>

      <div className="section-head"><h2>Đơn của bạn đi như thế nào</h2></div>
      <div className="panel panel-pad">
        <ol className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, margin: 0, paddingLeft: 18 }}>
          <li><b>Xác nhận đơn</b><p className="small muted">Nhân viên gọi xác nhận và chuẩn bị hàng trong ngày.</p></li>
          <li><b>Xếp tuyến tối ưu</b><p className="small muted">Hệ thống gom đơn cùng ngày, tính tuyến ngắn và đúng khung giờ bạn chọn.</p></li>
          <li><b>Chốt lịch, báo giờ</b><p className="small muted">Bạn nhận khung giờ dự kiến và vị trí của mình trong tuyến.</p></li>
          <li><b>Giao và lắp đặt</b><p className="small muted">Theo dõi còn bao nhiêu điểm trước bạn cho tới khi xe đến.</p></li>
        </ol>
      </div>
    </>
  );
}
