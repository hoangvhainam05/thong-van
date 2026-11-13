"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/mock/catalog";
import Art from "@/components/Art";
import ProductCard from "@/components/ProductCard";
import TiltCard from "@/components/TiltCard";
import { Loading } from "@/components/ui";
import { playTap } from "@/lib/audio-juice";
import {
  Truck,
  Wrench,
  ShieldCheck,
  CreditCard,
  ArrowRight,
  Sparkles,
  Flame,
  Award,
  ChevronRight,
} from "lucide-react";

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
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero modern-hero">
        <div className="hero-content">
          <div className="hud-badge hero-pill" style={{ marginBottom: 16 }}>
            <span className="live-dot" />
            <span>ĐIỆN MÁY THÔNG VÂN · HỆ THỐNG GIAO LẮP THÔNG MINH</span>
          </div>
          <h1>
            Điện máy cho tổ ấm, <br />
            <span className="text-gradient">giao chuẩn từng phút hẹn</span>
          </h1>
          <p className="lead">
            Khám phá thiết bị điện máy chính hãng cho gia đình. Khách hàng theo dõi chính xác thời gian thực: <b>còn bao nhiêu điểm giao trước bạn</b> và khung giờ xe tới. Hỗ trợ lắp đặt hoàn thiện tại gia.
          </p>
          <div className="row hero-actions" style={{ marginTop: 26, gap: 12 }}>
            <Link
              href="/products"
              className="btn lg btn-glow"
              onClick={() => playTap(850, 0.05)}
            >
              <span>Khám phá sản phẩm</span>
              <ArrowRight size={17} />
            </Link>
            <Link
              href="/track"
              className="btn lg secondary"
              onClick={() => playTap(700, 0.05)}
            >
              <Truck size={17} />
              <span>Tra cứu lộ trình</span>
            </Link>
          </div>

          {/* Quick Value Metrics */}
          <div className="hero-metrics">
            <div className="hero-metric-item">
              <span className="hero-metric-val">100%</span>
              <span className="hero-metric-lbl">Chính hãng</span>
            </div>
            <div className="hero-metric-divider" />
            <div className="hero-metric-item">
              <span className="hero-metric-val">~30p</span>
              <span className="hero-metric-lbl">Khung giờ hẹn</span>
            </div>
            <div className="hero-metric-divider" />
            <div className="hero-metric-item">
              <span className="hero-metric-val">24/7</span>
              <span className="hero-metric-lbl">Tra cứu trực tiếp</span>
            </div>
          </div>
        </div>

        {best[0] && (
          <div className="home-featured">
            <div className="home-featured-label">
              <span className="row" style={{ gap: 6, alignItems: "center" }}>
                <Sparkles size={15} color="var(--signal)" />
                <b>Sản phẩm bán chạy nhất</b>
              </span>
              <Link href="/products" className="small strong" onClick={() => playTap(700, 0.03)}>
                Xem tất cả →
              </Link>
            </div>
            <ProductCard p={best[0]} />
          </div>
        )}
      </section>

      {/* Trust Highlights Grid */}
      <section className="trust-grid">
        <div className="trust-card">
          <div className="trust-icon-wrap" style={{ background: "rgba(245, 158, 11, 0.12)", color: "var(--signal)" }}>
            <Truck size={22} />
          </div>
          <div>
            <h4>Biết chính xác số điểm trước bạn</h4>
            <p>Hệ thống định tuyến thông minh cập nhật trực tiếp thứ tự điểm giao và khung giờ xe tới.</p>
          </div>
        </div>

        <div className="trust-card">
          <div className="trust-icon-wrap" style={{ background: "rgba(27, 79, 140, 0.12)", color: "var(--road)" }}>
            <Wrench size={22} />
          </div>
          <div>
            <h4>Lắp đặt chuyên nghiệp tại nhà</h4>
            <p>Đội ngũ kỹ thuật viên giàu kinh nghiệm hỗ trợ đấu nối, kiểm tra vận hành và bàn giao nghiệm thu.</p>
          </div>
        </div>

        <div className="trust-card">
          <div className="trust-icon-wrap" style={{ background: "rgba(16, 185, 129, 0.12)", color: "var(--go)" }}>
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4>Bảo hành chính hãng điện tử</h4>
            <p>Kích hoạt bảo hành tức thì trên hệ thống, quản lý lịch sử bảo dưỡng ngay tại trang tài khoản.</p>
          </div>
        </div>

        <div className="trust-card">
          <div className="trust-icon-wrap" style={{ background: "rgba(99, 102, 241, 0.12)", color: "var(--plan)" }}>
            <CreditCard size={22} />
          </div>
          <div>
            <h4>Thanh toán tiện lợi & linh hoạt</h4>
            <p>Hỗ trợ quét mã QR PayOS tức thời, chuyển khoản ngân hàng hoặc thanh toán tiền mặt khi nhận hàng.</p>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <div className="section-head" style={{ marginTop: 24 }}>
        <h2 className="row" style={{ gap: 8, alignItems: "center" }}>
          <span>Danh mục sản phẩm</span>
        </h2>
        <Link href="/products" className="small strong view-all-link" onClick={() => playTap(750, 0.03)}>
          <span>Xem tất cả danh mục</span>
          <ChevronRight size={15} />
        </Link>
      </div>
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
            <span className="cat-tile-title">{c.name}</span>
          </TiltCard>
        ))}
      </div>

      {/* Hot Deals Section */}
      {deals.length > 0 && (
        <>
          <div className="section-head" id="uu-dai" style={{ marginTop: 36 }}>
            <h2 className="row" style={{ gap: 8, alignItems: "center" }}>
              <Flame size={22} color="var(--stop)" className="flame-icon-pulse" />
              <span>Đang giảm giá sốc</span>
            </h2>
            <Link
              href="/products?sort=sale"
              className="small strong view-all-link"
              onClick={() => playTap(800, 0.04)}
            >
              <span>Xem tất cả ưu đãi</span>
              <ChevronRight size={15} />
            </Link>
          </div>
          <div className="product-grid">
            {deals.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        </>
      )}

      {/* Bestsellers Section */}
      <div className="section-head" style={{ marginTop: 36 }}>
        <h2 className="row" style={{ gap: 8, alignItems: "center" }}>
          <Award size={22} color="var(--signal)" />
          <span>Sản phẩm bán chạy</span>
        </h2>
        <Link
          href="/products?sort=popular"
          className="small strong view-all-link"
          onClick={() => playTap(750, 0.03)}
        >
          <span>Xem thêm sản phẩm</span>
          <ChevronRight size={15} />
        </Link>
      </div>
      <div className="product-grid">
        {best.map((p) => (
          <ProductCard key={p.id} p={p} />
        ))}
      </div>
    </div>
  );
}
