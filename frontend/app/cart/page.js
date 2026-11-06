"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { vnd } from "@/lib/format";
import Art from "@/components/Art";
import { Empty, Loading } from "@/components/ui";

function CartProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  const imageUrl = product.images?.find((image) => image?.imageUrl)?.imageUrl || product.imageUrl;

  if (!imageUrl || failed) return <Art category={product.category} className="thumb-art" />;
  return (
    <img
      src={imageUrl}
      alt={product.name}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      style={{ width: "100%", height: "100%", objectFit: "contain" }}
    />
  );
}

export default function CartPage() {
  const { ready, state, actions, user, can, catalogStatus, shippingStatus } = useStore();
  const router = useRouter();
  const [selectedProductIds, setSelectedProductIds] = useState(null);
  if (!ready || catalogStatus === 'loading' || shippingStatus === 'loading') return <Loading />;
  if (catalogStatus !== 'ready' || shippingStatus !== 'ready') return <div className="notice bad">Không tải được sản phẩm hoặc phí giao hàng. Vui lòng tải lại trang.</div>;
  const lines = state.cart.map((l) => ({ ...l, p: state.products.find((x) => x.id === l.productId) })).filter((l) => l.p);
  const selectedIds = selectedProductIds ?? lines.map((line) => String(line.productId));
  const selectedIdSet = new Set(selectedIds);
  const selectedLines = lines.filter((line) => selectedIdSet.has(String(line.productId)));
  const allSelected = lines.length > 0 && selectedLines.length === lines.length;
  const subtotal = selectedLines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const install = selectedLines.reduce((s, l) => s + l.p.install * l.qty, 0);

  if (!lines.length)
    return <div className="panel"><Empty title="Giỏ hàng đang trống" action={<Link href="/products" className="btn">Chọn sản phẩm</Link>}>Thêm sản phẩm để đặt hàng và chọn khung giờ giao.</Empty></div>;

  const staffBlocked = user && !can("order.place");
  return (
    <>
      <h1 style={{ marginBottom: 18 }}>Giỏ hàng</h1>
      <div className="two-col">
        <div className="panel">
          <div className="row between" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
            <label className="check" style={{ minHeight: 44 }}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={(input) => {
                  if (input) input.indeterminate = selectedLines.length > 0 && !allSelected;
                }}
                onChange={(event) => setSelectedProductIds(event.target.checked ? lines.map((line) => String(line.productId)) : [])}
                aria-label="Chọn tất cả sản phẩm"
              />
              <span>Chọn tất cả</span>
            </label>
            <span className="small muted">Đã chọn {selectedLines.length}/{lines.length} sản phẩm</span>
          </div>
          {lines.map((l) => (
            <div key={l.productId} className="row" style={{ padding: 16, borderBottom: "1px solid var(--line-soft)", alignItems: "flex-start", background: selectedIdSet.has(String(l.productId)) ? "var(--paper)" : "var(--ground)" }}>
              <label className="check" style={{ width: 44, minWidth: 44, height: 44, flex: "none", justifyContent: "center" }}>
                <input
                  type="checkbox"
                  checked={selectedIdSet.has(String(l.productId))}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setSelectedProductIds((current) => {
                      const next = new Set(current ?? lines.map((line) => String(line.productId)));
                      if (checked) next.add(String(l.productId));
                      else next.delete(String(l.productId));
                      return [...next];
                    });
                  }}
                  aria-label={`Chọn ${l.p.name} để thanh toán`}
                />
              </label>
              <div style={{ width: 72, height: 72, background: "var(--ground)", borderRadius: 8, display: "grid", placeItems: "center", color: "var(--road)", flex: "none" }}>
                <CartProductImage product={l.p} />
              </div>
              <div className="grow stack-sm">
                <Link href={`/products/${l.p.id}`} className="strong">{l.p.name}</Link>
                <span className="small muted">{l.p.install ? `Lắp đặt ~${l.p.install} phút/sản phẩm` : "Không cần lắp đặt"}</span>
                <div className="row">
                  <div className="seg">
                    <button onClick={() => actions.setCartQty(l.productId, l.qty - 1)} aria-label="Giảm">−</button>
                    <button style={{ minWidth: 40, cursor: "default" }}>{l.qty}</button>
                    <button onClick={() => actions.setCartQty(l.productId, Math.min(l.qty + 1, l.p.stock))} aria-label="Tăng">+</button>
                  </div>
                  <button className="btn ghost sm" onClick={() => actions.setCartQty(l.productId, 0)}>Xoá</button>
                </div>
              </div>
              <div className="price nowrap">{vnd(l.p.price * l.qty)}</div>
            </div>
          ))}
        </div>
        <aside className="panel panel-pad stack">
          <h3>Tóm tắt</h3>
          <div className="stack-sm small">
            <div className="row between"><span className="muted">Sản phẩm đã chọn</span><span>{selectedLines.length}</span></div>
            <div className="row between"><span className="muted">Tạm tính</span><span>{vnd(subtotal)}</span></div>
            <div className="row between"><span className="muted">Phí giao hàng</span><span className="muted">Tính tại bước checkout</span></div>
            {install > 0 && <div className="row between"><span className="muted">Thời gian lắp đặt dự kiến</span><span>{install} phút</span></div>}
          </div>
          <div className="divider" />
          <div className="row between"><b>Tạm tính</b><span className="price" style={{ fontSize: 22 }}>{vnd(subtotal)}</span></div>
          {staffBlocked ? (
            <div className="notice warn">Tài khoản nhân viên không đặt hàng được. Đăng nhập bằng tài khoản khách hàng để thử luồng mua hàng.</div>
          ) : (
            <button
              className="btn lg block"
              disabled={!selectedLines.length}
              onClick={() => {
                const params = new URLSearchParams({ items: JSON.stringify(selectedLines.map((line) => line.productId)) });
                const checkoutPath = `/checkout?${params.toString()}`;
                router.push(user ? checkoutPath : `/login?next=${encodeURIComponent(checkoutPath)}`);
              }}
            >
              {user ? "Tiếp tục đặt hàng" : "Đăng nhập để đặt hàng"}
            </button>
          )}
          {!selectedLines.length && <p className="small muted">Chọn ít nhất một sản phẩm để tiếp tục.</p>}
        </aside>
      </div>
    </>
  );
}
