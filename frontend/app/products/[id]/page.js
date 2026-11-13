"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { useCategories } from "@/lib/categories";
import { vnd } from "@/lib/format";
import Art from "@/components/Art";
import ProductCard from "@/components/ProductCard";
import { Empty, Loading } from "@/components/ui";
import { playSuccess, playTap } from "@/lib/audio-juice";
import {
  ShieldCheck,
  Wrench,
  Package,
  Truck,
  ShoppingCart,
  Zap,
  Star,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function ProductDetail() {
  const { categories } = useCategories();
  const { id } = useParams();
  const router = useRouter();
  const { ready, catalogStatus, shippingStatus, state, actions } = useStore();
  const [qty, setQty] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  if (!ready || catalogStatus === "loading") return <Loading message="Đang tải thông tin sản phẩm…" />;
  if (catalogStatus === "error")
    return (
      <div className="panel">
        <Empty title="Không tải được sản phẩm">Kiểm tra kết nối máy chủ và tải lại trang.</Empty>
      </div>
    );

  const p = state.products.find((x) => x.id === Number(id));
  if (!p || !p.active)
    return (
      <div className="panel">
        <Empty
          title="Sản phẩm không còn bán"
          action={
            <Link className="btn" href="/products">
              Xem sản phẩm khác
            </Link>
          }
        />
      </div>
    );

  const images = p.images?.length ? p.images : p.imageUrl ? [{ imageUrl: p.imageUrl }] : [];
  const cat = categories.find((c) => c.id === p.category);
  const related = state.products
    .filter((x) => x.category === p.category && x.id !== p.id && x.active)
    .slice(0, 4);

  const handleAddToCart = () => {
    actions.addToCart(p.id, qty);
    playSuccess();
  };

  const handleBuyNow = () => {
    playTap(850, 0.04);
    router.push(`/checkout?buyNow=${p.id}&qty=${qty}`);
  };

  return (
    <div className="stack" style={{ gap: 28 }}>
      <nav className="small muted row" style={{ gap: 6, alignItems: "center" }}>
        <Link href="/products" className="strong">Sản phẩm</Link>
        <span>/</span>
        <Link href={`/products?cat=${p.category}`}>{cat?.name || p.category}</Link>
        <span>/</span>
        <span className="truncate">{p.name}</span>
      </nav>

      <div className="product-detail-layout">
        {/* Left Gallery */}
        <div className="stack-sm">
          <div
            className="panel"
            style={{
              aspectRatio: "1 / 1",
              display: "grid",
              placeItems: "center",
              color: "var(--road)",
              background: "#fff",
              borderRadius: "var(--r-xl)",
              overflow: "hidden",
              boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
              padding: 16,
            }}
          >
            {images.length ? (
              <img
                src={images[selectedImage]?.imageUrl || images[0].imageUrl}
                alt={p.name}
                style={{ width: "100%", height: "100%", objectFit: "contain", transition: "transform 0.3s ease" }}
              />
            ) : (
              <Art category={p.category} className="detail-art" label={p.name} />
            )}
          </div>

          {images.length > 1 && (
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {images.map((image, index) => (
                <button
                  type="button"
                  key={`${image.imageUrl}-${index}`}
                  onClick={() => {
                    playTap(700, 0.03);
                    setSelectedImage(index);
                  }}
                  aria-label={`Xem ảnh ${index + 1}`}
                  aria-pressed={index === selectedImage}
                  style={{
                    border: index === selectedImage ? "2px solid var(--road)" : "1px solid var(--line)",
                    borderRadius: 8,
                    padding: 3,
                    background: "white",
                    cursor: "pointer",
                    boxShadow: index === selectedImage ? "0 0 10px rgba(27, 79, 140, 0.3)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <img
                    src={image.imageUrl}
                    alt=""
                    style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4 }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Info */}
        <div className="stack" style={{ gap: 20 }}>
          <div>
            <div className="small muted">
              <b>{p.brand}</b> · Mã SP: {p.sku}
            </div>
            <h1 style={{ fontSize: 28, marginTop: 6, lineHeight: 1.25 }}>{p.name}</h1>
            <div className="row" style={{ gap: 12, marginTop: 8, alignItems: "center" }}>
              <span className="rating-pill">
                <Star size={13} fill="#f59e0b" color="#f59e0b" /> {p.rating}
              </span>
              <span className="small muted">Đã bán {p.sold} sản phẩm</span>
            </div>
          </div>

          <div className="price-box" style={{ background: "var(--ground)", padding: "16px 20px", borderRadius: "var(--r-lg)", border: "1px solid var(--line-soft)" }}>
            {p.oldPrice && <div className="strike" style={{ fontSize: 16 }}>{vnd(p.oldPrice)}</div>}
            <div className="price" style={{ fontSize: 32, color: "var(--road-deep)" }}>
              {vnd(p.price)}
            </div>
          </div>

          <p style={{ lineHeight: 1.65, color: "var(--ink)" }}>{p.description}</p>

          {/* Key Specs Card */}
          <div className="panel panel-pad stack-sm small" style={{ background: "#ffffff" }}>
            <div className="row between">
              <span className="muted row" style={{ gap: 6, alignItems: "center" }}>
                <ShieldCheck size={16} color="var(--go)" /> Thời hạn bảo hành
              </span>
              <b>{p.warranty} tháng chính hãng</b>
            </div>
            <div className="row between">
              <span className="muted row" style={{ gap: 6, alignItems: "center" }}>
                <Wrench size={16} color="var(--signal)" /> Lắp đặt tại nhà
              </span>
              <b>{p.install > 0 ? `Kỹ thuật viên lắp ~${p.install} phút` : "Giao nhanh, không cần lắp"}</b>
            </div>
            <div className="row between">
              <span className="muted row" style={{ gap: 6, alignItems: "center" }}>
                <Package size={16} color="var(--plan)" /> Kích thước đóng gói
              </span>
              <b>{p.volume} m³ · {p.weight} kg</b>
            </div>
            <div className="row between">
              <span className="muted row" style={{ gap: 6, alignItems: "center" }}>
                <Truck size={16} color="var(--road)" /> Tình trạng kho
              </span>
              <b style={{ color: p.stock ? "var(--go)" : "var(--stop)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                {p.stock ? (
                  <>
                    <CheckCircle2 size={14} /> Còn {p.stock} sản phẩm
                  </>
                ) : (
                  <>
                    <XCircle size={14} /> Tạm hết hàng
                  </>
                )}
              </b>
            </div>
          </div>

          {/* Actions */}
          <div className="row" style={{ gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div className="seg" aria-label="Số lượng">
              <button
                onClick={() => {
                  playTap(700, 0.03);
                  setQty((q) => Math.max(1, q - 1));
                }}
                aria-label="Giảm số lượng"
              >
                −
              </button>
              <button aria-pressed="false" style={{ minWidth: 46, cursor: "default", fontWeight: 700 }}>
                {qty}
              </button>
              <button
                onClick={() => {
                  playTap(750, 0.03);
                  setQty((q) => Math.min(10, p.stock, q + 1));
                }}
                aria-label="Tăng số lượng"
              >
                +
              </button>
            </div>

            <button
              className="btn secondary lg row"
              style={{ gap: 8 }}
              disabled={!p.stock}
              onClick={handleAddToCart}
            >
              <ShoppingCart size={18} />
              <span>Thêm vào giỏ</span>
            </button>

            <button
              className="btn lg btn-glow row"
              style={{ gap: 8 }}
              disabled={!p.stock}
              onClick={handleBuyNow}
            >
              <Zap size={18} />
              <span>Mua ngay</span>
            </button>
          </div>

          {shippingStatus === "ready" && (
            <p className="small muted">
              Phí giao hàng được tính toán chính xác theo quãng đường thực tế và tải trọng xe ở bước đặt hàng.
            </p>
          )}
        </div>
      </div>

      {related.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <div className="section-head">
            <h2>Các sản phẩm tương tự bạn có thể thích</h2>
          </div>
          <div className="product-grid">
            {related.map((x) => (
              <ProductCard key={x.id} p={x} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
