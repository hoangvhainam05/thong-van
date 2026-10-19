"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/mock/catalog";
import { homeFor, ROLES } from "@/lib/rbac";
import { Avatar } from "./ui";

function CategoryBar() {
  const params = useSearchParams();
  const pathname = usePathname();
  const current = pathname === "/products" ? params.get("cat") : null;
  return (
    <nav className="shop-cats" aria-label="Danh mục">
      <div className="shop-cats-inner">
        <Link href="/products" className={pathname === "/products" && !current ? "on" : ""}>Tất cả</Link>
        {CATEGORIES.map((c) => (
          <Link key={c.id} href={`/products?cat=${c.id}`} className={current === c.id ? "on" : ""}>{c.name}</Link>
        ))}
      </div>
    </nav>
  );
}

function UserMenu() {
  const { user, state, actions } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!user) {
    return (
      <>
        <Link href="/login">Đăng nhập</Link>
        <Link href="/register" className="label">Đăng ký</Link>
      </>
    );
  }
  const unread = state.notifications.filter((n) => n.customerId === user.customerId && !n.read).length;
  const isCustomer = user.role === "CUSTOMER";
  return (
    <div className="user-menu" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Avatar name={user.name} />
        <span className="label">{user.name.split(" ").slice(-1)[0]}</span>
        {unread > 0 && <span className="pill">{unread}</span>}
      </button>
      {open && (
        <div className="menu" onClick={() => setOpen(false)}>
          <div className="menu-head">
            <div className="strong">{user.name}</div>
            <div className="small muted">{ROLES[user.role].label}</div>
          </div>
          {isCustomer ? (
            <>
              <Link href="/account/orders">Đơn hàng của tôi</Link>
              <Link href="/account/notifications">Thông báo {unread > 0 && <span className="badge move plain">{unread} mới</span>}</Link>
              <Link href="/account/profile">Tài khoản và địa chỉ</Link>
            </>
          ) : (
            <Link href={homeFor(state.roleMatrix, user.role)}>Vào trang làm việc</Link>
          )}
          <button onClick={() => { actions.logout(); router.push("/"); }}>Đăng xuất</button>
        </div>
      )}
    </div>
  );
}

export default function ShopShell({ children }) {
  const { state } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const cartCount = state?.cart.reduce((s, l) => s + l.qty, 0) || 0;
  return (
    <>
      <header className="shop-top">
        <div className="shop-top-inner">
          <Link href="/" className="logo"><span className="logo-mark">TV</span>Thông Vân</Link>
          <form className="shop-search" role="search" onSubmit={(e) => { e.preventDefault(); router.push(`/products?q=${encodeURIComponent(q)}`); }}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tủ lạnh, máy giặt, điều hoà…" aria-label="Tìm sản phẩm" />
          </form>
          <nav className="shop-nav">
            <Link href="/track">Tra cứu đơn</Link>
            <Link href="/cart">Giỏ hàng {cartCount > 0 && <span className="pill">{cartCount}</span>}</Link>
            <UserMenu />
          </nav>
        </div>
      </header>
      <Suspense fallback={null}><CategoryBar /></Suspense>
      <main className="shop-main">{children}</main>
      <footer className="shop-foot">
        <div className="shop-foot-inner">
          <div>
            <div className="logo" style={{ color: "var(--ink)", marginBottom: 8 }}><span className="logo-mark">TV</span>Điện máy Thông Vân</div>
            <p>Giao và lắp đặt tận nhà. Theo dõi chính xác còn bao nhiêu điểm giao trước bạn.</p>
          </div>
          <div>
            <h4>Hỗ trợ</h4>
            <p>Hotline 1900 0000 (mẫu)</p>
            <p>8:00 – 18:00 hằng ngày</p>
          </div>
          <div>
            <h4>Dành cho nhân viên</h4>
            <p><Link href="/login">Đăng nhập trang làm việc</Link></p>
          </div>
        </div>
      </footer>
    </>
  );
}
