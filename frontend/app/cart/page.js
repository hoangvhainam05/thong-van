"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { vnd } from "@/lib/format";
import Art from "@/components/Art";
import { Empty, Loading } from "@/components/ui";

export default function CartPage() {
  const { ready, state, actions, user, can, catalogStatus, shippingStatus } = useStore();
  const router = useRouter();
  if (!ready || catalogStatus === 'loading' || shippingStatus === 'loading') return <Loading />;
  if (catalogStatus !== 'ready' || shippingStatus !== 'ready') return <div className="notice bad">Không tải được sản phẩm hoặc phí giao hàng. Vui lòng tải lại trang.</div>;
  const lines = state.cart.map((l) => ({ ...l, p: state.products.find((x) => x.id === l.productId) })).filter((l) => l.p);
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const ship = subtotal >= state.settings.freeShipFrom || !subtotal ? 0 : state.settings.shippingFee;
  const install = lines.reduce((s, l) => s + l.p.install * l.qty, 0);

  if (!lines.length)
    return <div className="panel"><Empty title="Giỏ hàng đang trống" action={<Link href="/products" className="btn">Chọn sản phẩm</Link>}>Thêm sản phẩm để đặt hàng và chọn khung giờ giao.</Empty></div>;

  const staffBlocked = user && !can("order.place");
  return (
    <>
      <h1 style={{ marginBottom: 18 }}>Giỏ hàng</h1>
      <div className="two-col">
        <div className="panel">
          {lines.map((l) => (
            <div key={l.productId} className="row" style={{ padding: 16, borderBottom: "1px solid var(--line-soft)", alignItems: "flex-start" }}>
              <div style={{ width: 72, height: 72, background: "var(--ground)", borderRadius: 8, display: "grid", placeItems: "center", color: "var(--road)", flex: "none" }}>
                <Art category={l.p.category} className="thumb-art" />
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
            <div className="row between"><span className="muted">Tạm tính</span><span>{vnd(subtotal)}</span></div>
            <div className="row between"><span className="muted">Phí giao hàng</span><span>{ship ? vnd(ship) : "Miễn phí"}</span></div>
            {install > 0 && <div className="row between"><span className="muted">Thời gian lắp đặt dự kiến</span><span>{install} phút</span></div>}
          </div>
          <div className="divider" />
          <div className="row between"><b>Tổng cộng</b><span className="price" style={{ fontSize: 22 }}>{vnd(subtotal + ship)}</span></div>
          {staffBlocked ? (
            <div className="notice warn">Tài khoản nhân viên không đặt hàng được. Đăng nhập bằng tài khoản khách hàng để thử luồng mua hàng.</div>
          ) : (
            <button className="btn lg block" onClick={() => router.push(user ? "/checkout" : "/login?next=/checkout")}>
              {user ? "Tiếp tục đặt hàng" : "Đăng nhập để đặt hàng"}
            </button>
          )}
        </aside>
      </div>
    </>
  );
}
