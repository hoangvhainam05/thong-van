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

export default function ProductDetail() {
  const { categories } = useCategories();
  const { id } = useParams();
  const router = useRouter();
  const { ready, catalogStatus, shippingStatus, state, actions } = useStore();
  const [qty, setQty] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  if (!ready || catalogStatus === "loading") return <Loading />;
  if (catalogStatus === "error") return <div className="panel"><Empty title="Không tải được sản phẩm">Kiểm tra kết nối máy chủ và tải lại trang.</Empty></div>;
  const p = state.products.find((x) => x.id === Number(id));
  if (!p || !p.active) return <div className="panel"><Empty title="Sản phẩm không còn bán" action={<Link className="btn" href="/products">Xem sản phẩm khác</Link>} /></div>;
  const images = p.images?.length ? p.images : (p.imageUrl ? [{ imageUrl: p.imageUrl }] : []);
  const cat = categories.find((c) => c.id === p.category);
  const related = state.products.filter((x) => x.category === p.category && x.id !== p.id && x.active).slice(0, 4);

  return (
    <>
      <nav className="small muted" style={{ marginBottom: 14 }}>
        <Link href="/products">Sản phẩm</Link> / <Link href={`/products?cat=${p.category}`}>{cat?.name || p.category}</Link>
      </nav>
      <div className="two-col" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="stack-sm"><div className="panel" style={{ aspectRatio: "1 / 1", display: "grid", placeItems: "center", color: "var(--road)", background: "linear-gradient(180deg,#f3f6fa,#e6ecf3)" }}>
          {images.length ? <img src={images[selectedImage]?.imageUrl || images[0].imageUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Art category={p.category} className="detail-art" label={p.name} />}
        </div>
        {images.length > 1 && <div className="row" style={{ flexWrap: "wrap" }}>{images.map((image, index) => <button type="button" key={`${image.imageUrl}-${index}`} onClick={() => setSelectedImage(index)} aria-label={`Xem ảnh ${index + 1}`} aria-pressed={index === selectedImage} style={{ border: index === selectedImage ? "2px solid var(--road)" : "1px solid #ddd", padding: 2, background: "white" }}><img src={image.imageUrl} alt="" style={{ width: 64, height: 64, objectFit: "cover" }} /></button>)}</div>}</div>
        <div className="stack">
          <div>
            <div className="small muted">{p.brand} · Mã {p.sku}</div>
            <h1 style={{ fontSize: 26, marginTop: 4 }}>{p.name}</h1>
            <div className="small muted" style={{ marginTop: 6 }}>★ {p.rating} · Đã bán {p.sold}</div>
          </div>
          <div>
            {p.oldPrice && <div className="strike">{vnd(p.oldPrice)}</div>}
            <div className="price" style={{ fontSize: 30 }}>{vnd(p.price)}</div>
          </div>
          <p>{p.description}</p>
          <div className="panel panel-pad stack-sm small">
            <div className="row between"><span className="muted">Bảo hành</span><b>{p.warranty} tháng</b></div>
            <div className="row between"><span className="muted">Lắp đặt tại nhà</span><b>{p.install > 0 ? `khoảng ${p.install} phút` : "Không cần"}</b></div>
            <div className="row between"><span className="muted">Kích thước đóng gói</span><b>{p.volume} m³ · {p.weight} kg</b></div>
            <div className="row between"><span className="muted">Tình trạng</span><b style={{ color: p.stock ? "var(--go)" : "var(--stop)" }}>{p.stock ? `Còn ${p.stock} sản phẩm` : "Tạm hết hàng"}</b></div>
          </div>
          <div className="row">
            <div className="seg" aria-label="Số lượng">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Giảm">−</button>
              <button aria-pressed="false" style={{ minWidth: 44, cursor: "default" }}>{qty}</button>
              <button onClick={() => setQty((q) => Math.min(10, p.stock, q + 1))} aria-label="Tăng">+</button>
            </div>
            <button className="btn secondary lg" disabled={!p.stock} onClick={() => actions.addToCart(p.id, qty)}>Thêm vào giỏ</button>
            <button className="btn lg" disabled={!p.stock} onClick={() => { actions.addToCart(p.id, qty); router.push("/cart"); }}>Mua ngay</button>
          </div>
          {shippingStatus === "ready" && <p className="small muted">Miễn phí giao cho đơn từ {vnd(state.settings.freeShipFrom)}. Bạn chọn ngày và khung giờ nhận hàng ở bước thanh toán.</p>}
        </div>
      </div>
      {related.length > 0 && (
        <>
          <div className="section-head"><h2>Cùng danh mục</h2></div>
          <div className="product-grid">{related.map((x) => <ProductCard key={x.id} p={x} />)}</div>
        </>
      )}
    </>
  );
}
