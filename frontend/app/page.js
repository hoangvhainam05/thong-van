"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/mock/catalog";
import Art from "@/components/Art";
import ProductCard from "@/components/ProductCard";
import TiltCard from "@/components/TiltCard";
import { Loading } from "@/components/ui";
import { playTap } from "@/lib/audio-juice";

export default function HomePage() {
  const { ready, state } = useStore();

  if (!ready) return <Loading />;
  const active = state.products.filter((p) => p.active);
  const deals = active
    .filter((p) => p.oldPrice)
    .sort((a, b) => b.oldPrice - b.price - (a.oldPrice - a.price))
    .slice(0, 6);
  const best = [...active].sort((a, b) => b.sold - a.sold).slice(0, 12);

  return (
    <>
      <section className="hero">
        <div>
          <div className="hud-badge" style={{ marginBottom: 14 }}>ĐIỆN MÁY THÔNG VÂN</div>
          <h1>Điện máy cho tổ ấm của bạn</h1>
          <p className="lead">Khám phá các sản phẩm điện máy cho gia đình, chọn món phù hợp và đặt hàng dễ dàng. Thông Vân hỗ trợ giao hàng và lắp đặt tận nơi.</p>
          <div className="row" style={{ marginTop: 22 }}>
            <Link href="/products" className="btn lg" onClick={() => playTap(850, 0.05)}>Xem sản phẩm</Link>
            {deals.length > 0 && <a href="#uu-dai" className="btn lg secondary" onClick={() => playTap(700, 0.05)}>Xem ưu đãi</a>}
          </div>
        </div>
        {best[0] && <div className="home-featured">
          <div className="home-featured-label"><span>Sản phẩm nổi bật</span><Link href="/products" className="small strong">Xem thêm →</Link></div>
          <ProductCard p={best[0]} />
        </div>}
      </section>

      <div className="section-head"><h2>Danh mục</h2></div>
      <div className="cat-row">
        {CATEGORIES.map((c) => (
          <TiltCard
            key={c.id}
            as={Link}
            href={`/products?cat=${c.id}`}
            className="cat-tile"
            maxTilt={8}
            onClick={() => playTap(700, 0.04)}
          >
            <Art icon={c.icon} className="art" />
            {c.name}
          </TiltCard>
        ))}
      </div>

      {deals.length > 0 && <>
      <div className="section-head" id="uu-dai">
        <h2>Đang giảm giá</h2>
        <Link
          href="/products?sort=sale"
          className="small strong"
          style={{ color: "var(--road)" }}
          onClick={() => playTap(800, 0.04)}
        >
          Xem tất cả
        </Link>
      </div>
      <div className="product-grid">
        {deals.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>

      </>}

      <div className="section-head"><h2>Bán chạy</h2></div>
      <div className="product-grid">
        {best.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>

    </>
  );
}
