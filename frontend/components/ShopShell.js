"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useCategories } from "@/lib/categories";
import { homeFor, ROLES } from "@/lib/rbac";
import { api, loadToken } from "@/lib/api";
import { Avatar } from "./ui";
import SoundToggle from "./SoundToggle";
import { playTap } from "@/lib/audio-juice";
import {
  Search,
  ShoppingCart,
  Truck,
  Bell,
  Package,
  ShieldCheck,
  User,
  LogOut,
  Briefcase,
  X,
  Sparkles,
} from "lucide-react";

function CategoryBar() {
  const { categories } = useCategories();
  const params = useSearchParams();
  const pathname = usePathname();
  const current = pathname === "/products" ? params.get("cat") : null;
  return (
    <nav className="shop-cats" aria-label="Danh mục sản phẩm">
      <div className="shop-cats-inner">
        <Link
          href="/products"
          className={pathname === "/products" && !current ? "on" : ""}
          onClick={() => playTap(700, 0.03)}
        >
          <Sparkles size={14} className="cat-icon-inline" />
          <span>Tất cả</span>
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/products?cat=${c.id}`}
            className={current === c.id ? "on" : ""}
            onClick={() => playTap(700, 0.03)}
          >
            {c.name}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function UserMenu() {
  const { user, state, actions, can } = useStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const notificationAllowed = !!user && can("notification.own");
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  useEffect(() => {
    if (!notificationAllowed) {
      setUnread(0);
      return;
    }
    let active = true;
    const refresh = () =>
      api("/api/account/notifications", { token: loadToken() })
        .then((data) => {
          if (active) setUnread(data.unread);
        })
        .catch(() => {
          if (active) setUnread(0);
        });
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("thongvan-notifications", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("thongvan-notifications", refresh);
    };
  }, [user?.id, notificationAllowed]);

  if (!user) {
    return (
      <div className="row" style={{ gap: 6, alignItems: "center" }}>
        <Link href="/login" className="btn ghost sm" onClick={() => playTap(700, 0.03)}>
          Đăng nhập
        </Link>
        <Link href="/register" className="btn sm" onClick={() => playTap(800, 0.03)}>
          Đăng ký
        </Link>
      </div>
    );
  }

  const canTrack = can("order.track_own");
  return (
    <div className="user-menu" ref={ref}>
      <button
        onClick={() => {
          playTap(750, 0.03);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="user-menu-trigger"
      >
        <div className="user-avatar-wrap">
          <Avatar name={user.name} />
          <span className="user-online-dot" />
        </div>
        <span className="label">{user.name.split(" ").slice(-1)[0]}</span>
        {unread > 0 && <span className="pill shimmer-badge">{unread}</span>}
      </button>
      {open && (
        <div className="menu animate-pop-in" onClick={() => setOpen(false)}>
          <div className="menu-head">
            <div className="strong truncate">{user.name}</div>
            <div className="small muted">{ROLES[user.role]?.label || user.role}</div>
          </div>
          {canTrack ? (
            <>
              <Link href="/account/orders" onClick={() => playTap(700, 0.03)}>
                <Package size={15} /> Đơn hàng của tôi
              </Link>
              {notificationAllowed && (
                <Link href="/account/notifications" onClick={() => playTap(700, 0.03)}>
                  <Bell size={15} /> Thông báo
                  {unread > 0 && <span className="badge move plain" style={{ marginLeft: "auto" }}>{unread} mới</span>}
                </Link>
              )}
              <Link href="/account/warranties" onClick={() => playTap(700, 0.03)}>
                <ShieldCheck size={15} /> Bảo hành & bảo dưỡng
              </Link>
              <Link href="/account/profile" onClick={() => playTap(700, 0.03)}>
                <User size={15} /> Tài khoản
              </Link>
            </>
          ) : (
            <Link href={homeFor(state.roleMatrix, user.role)} onClick={() => playTap(700, 0.03)}>
              <Briefcase size={15} /> Vào trang làm việc
            </Link>
          )}
          {canTrack && (can("backoffice.access") || can("delivery.app")) && (
            <Link href={homeFor(state.roleMatrix, user.role)} onClick={() => playTap(700, 0.03)}>
              <Briefcase size={15} /> Vào trang làm việc
            </Link>
          )}
          <div className="divider" style={{ margin: "4px 0" }} />
          <button
            onClick={() => {
              playTap(600, 0.03);
              actions.logout();
              router.push("/");
            }}
            className="row"
            style={{ color: "var(--stop)", width: "100%", justifyContent: "flex-start", gap: 8 }}
          >
            <LogOut size={15} /> Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

export default function ShopShell({ children }) {
  const { state } = useStore();
  const router = useRouter();
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const cartCount = state?.cart?.reduce((s, l) => s + l.qty, 0) || 0;

  // Keyboard shortcut '/' to focus search
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <>
      <header className="shop-top">
        <div className="shop-top-inner">
          <Link
            href="/"
            className="logo shop-logo-icon"
            aria-label="Thông Vân — Trang chủ"
            onClick={() => playTap(800, 0.03)}
          >
            <img className="shop-logo-symbol" src="/brand-symbol.png" alt="" />
          </Link>

          <form
            className="shop-search"
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              playTap(750, 0.03);
              router.push(`/products?q=${encodeURIComponent(q)}`);
            }}
          >
            <Search size={16} className="search-icon" aria-hidden="true" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tủ lạnh, máy giặt, điều hoà…"
              aria-label="Tìm sản phẩm"
            />
            {q && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => {
                  setQ("");
                  inputRef.current?.focus();
                }}
                aria-label="Xoá tìm kiếm"
              >
                <X size={14} />
              </button>
            )}
            <kbd className="search-kbd" title="Nhấn phím / để tìm nhanh">/</kbd>
          </form>

          <nav className="shop-nav">
            <Link href="/track" onClick={() => playTap(700, 0.03)} className="nav-link-track">
              <Truck size={17} />
              <span>Tra cứu đơn</span>
            </Link>

            <Link href="/cart" onClick={() => playTap(750, 0.03)} className="nav-link-cart">
              <ShoppingCart size={17} />
              <span className="label">Giỏ hàng</span>
              {cartCount > 0 && <span className="pill cart-bounce">{cartCount}</span>}
            </Link>

            <SoundToggle />

            <div className="nav-divider" />

            <UserMenu />
          </nav>
        </div>
      </header>

      <Suspense fallback={null}>
        <CategoryBar />
      </Suspense>

      <main className="shop-main">{children}</main>

      <footer className="shop-foot">
        <div className="shop-foot-inner">
          <div className="foot-brand-col">
            <div className="logo" style={{ color: "var(--ink)", marginBottom: 12 }}>
              <img
                className="logo-image"
                src="/brand-logo.png"
                alt="Thông Vân — Điện tử thông minh, cuộc sống tiện nghi"
              />
            </div>
            <p>
              Hệ thống đặt hàng điện máy và tối ưu tuyến giao hàng thông minh. Khách hàng theo dõi chính xác từng phút còn bao nhiêu điểm giao trước bạn.
            </p>
            <div className="foot-trust-badges">
              <div className="foot-trust-item">
                <Truck size={16} color="var(--signal)" />
                <span>Giao hàng hẹn giờ chính xác</span>
              </div>
              <div className="foot-trust-item">
                <ShieldCheck size={16} color="var(--go)" />
                <span>Bảo hành chính hãng tại nhà</span>
              </div>
            </div>
          </div>

          <div>
            <h4>Hỗ trợ khách hàng</h4>
            <p><b>Tổng đài:</b> 1900 0000 (Miễn phí)</p>
            <p><b>Giờ phục vụ:</b> 8:00 – 18:00 hằng ngày</p>
            <p><b>Kỹ thuật & bảo hành:</b> support@thongvan.vn</p>
            <p style={{ marginTop: 12 }}>
              <Link href="/track" className="small strong" style={{ color: "var(--road)" }}>
                Tra cứu lộ trình đơn hàng →
              </Link>
            </p>
          </div>

          <div>
            <h4>Dành cho nhân viên</h4>
            <p>Khu vực nội bộ dành cho Điều phối viên, Bán hàng và Đội xe giao nhận:</p>
            <p style={{ marginTop: 10 }}>
              <Link href="/login" className="btn secondary sm" onClick={() => playTap(700, 0.03)}>
                Đăng nhập trang làm việc
              </Link>
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
