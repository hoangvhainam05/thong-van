"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/mock/catalog";
import { vnd } from "@/lib/format";
import Art from "@/components/Art";
import ProductCard from "@/components/ProductCard";
import { Empty, Loading } from "@/components/ui";

export default function ProductDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { ready, state, actions } = useStore();
  const [qty, setQty] = useState(1);
  if (!ready) return <Loading />;
  const p = state.products.find((x) => x.id === Number(id));
  if (!p || !p.active) return <div className="panel"><Empty title="Sản phẩm không còn bán" action={<Link className="btn" href="/products">Xem sản phẩm khác</Link>} /></div>;
  const cat = CATEGORIES.find((c) => c.id === p.category);
  const related = state.products.filter((x) => x.category === p.category && x.id !== p.id && x.active).slice(0, 4);

  return (
    <>
      <nav className="small muted" style={{ marginBottom: 14 }}>
        <Link href="/products">Sản phẩm</Link> / <Link href={`/products?cat=${cat.id}`}>{cat.name}</Link>
      </nav>
      <div className="two-col" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="panel" style={{ aspectRatio: "1 / 1", display: "grid", placeItems: "center", color: "var(--road)", background: "linear-gradient(180deg,#f3f6fa,#e6ecf3)" }}>
          {p.imageUrl ? <img src={p.imageUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Art category={p.category} className="detail-art" label={p.name} />}
        </div>
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
          <p className="small muted">Miễn phí giao cho đơn từ {vnd(state.settings.freeShipFrom)}. Bạn chọn ngày và khung giờ nhận hàng ở bước thanh toán.</p>
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
