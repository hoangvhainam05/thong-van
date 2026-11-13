"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { useCategories } from "@/lib/categories";
import ProductCard from "@/components/ProductCard";
import { Empty, Loading } from "@/components/ui";
import { playTap } from "@/lib/audio-juice";
import { SlidersHorizontal, RotateCcw, Tag } from "lucide-react";

const PRICE = [
  ["all", "Mọi mức giá"],
  ["0-5", "Dưới 5 triệu"],
  ["5-10", "5 – 10 triệu"],
  ["10-20", "10 – 20 triệu"],
  ["20-999", "Trên 20 triệu"],
];

function Catalog() {
  const { categories } = useCategories();
  const { ready, catalogStatus, state } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const cat = params.get("cat") || "";
  const q = params.get("q") || "";
  const [brands, setBrands] = useState([]);
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState(params.get("sort") || "popular");

  const list = useMemo(() => {
    if (!ready) return [];
    let l = state.products.filter((p) => p.active);
    if (cat) l = l.filter((p) => p.category === cat);
    if (q) l = l.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
    if (brands.length) l = l.filter((p) => brands.includes(p.brand));
    if (price !== "all") {
      const [a, b] = price.split("-").map((x) => Number(x) * 1e6);
      l = l.filter((p) => p.price >= a && p.price < b);
    }
    const sorters = {
      popular: (a, b) => b.sold - a.sold,
      asc: (a, b) => a.price - b.price,
      desc: (a, b) => b.price - a.price,
      sale: (a, b) => (b.oldPrice ? b.oldPrice - b.price : 0) - (a.oldPrice ? a.oldPrice - a.price : 0),
    };
    return [...l].sort(sorters[sort]);
  }, [ready, state, cat, q, brands, price, sort]);

  if (!ready || catalogStatus === "loading") return <Loading message="Đang tải danh mục sản phẩm…" />;
  if (catalogStatus === "error")
    return (
      <div className="panel">
        <Empty title="Không tải được sản phẩm">Kiểm tra kết nối máy chủ và tải lại trang.</Empty>
      </div>
    );

  const allBrands = [...new Set(state.products.filter((p) => !cat || p.category === cat).map((p) => p.brand))].sort();
  const title = q ? `Kết quả cho “${q}”` : categories.find((c) => c.id === cat)?.name || "Tất cả sản phẩm";

  return (
    <div className="shop-layout">
      {/* Filter Sidebar */}
      <aside className="panel panel-pad filter-box stack" style={{ gap: 18 }}>
        <div className="row between" style={{ alignItems: "center" }}>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <SlidersHorizontal size={17} color="var(--road)" />
            <h3 style={{ fontSize: 16 }}>Bộ lọc</h3>
          </div>
          {(brands.length > 0 || price !== "all" || q) && (
            <button
              className="btn ghost sm row"
              style={{ gap: 4, padding: "4px 8px" }}
              onClick={() => {
                playTap(600, 0.03);
                setBrands([]);
                setPrice("all");
                if (q) router.push(cat ? `/products?cat=${cat}` : "/products");
              }}
              title="Đặt lại bộ lọc"
            >
              <RotateCcw size={13} />
              <span className="small">Xoá lọc</span>
            </button>
          )}
        </div>

        <div className="stack-sm">
          <div className="small strong muted">Thương hiệu</div>
          {allBrands.map((b) => (
            <label key={b} className="check">
              <input
                type="checkbox"
                checked={brands.includes(b)}
                onChange={(e) => {
                  playTap(700, 0.03);
                  setBrands((x) => (e.target.checked ? [...x, b] : x.filter((y) => y !== b)));
                }}
              />
              <span>{b}</span>
            </label>
          ))}
        </div>

        <div className="divider" />

        <div className="stack-sm">
          <div className="small strong muted">Mức giá</div>
          {PRICE.map(([v, l]) => (
            <label key={v} className="check">
              <input
                type="radio"
                name="price"
                checked={price === v}
                onChange={() => {
                  playTap(700, 0.03);
                  setPrice(v);
                }}
              />
              <span>{l}</span>
            </label>
          ))}
        </div>
      </aside>

      {/* Product List Section */}
      <section>
        <div className="row between" style={{ marginBottom: 16, alignItems: "baseline" }}>
          <div>
            <h1 style={{ fontSize: 26 }}>{title}</h1>
            <p className="small muted">{list.length} sản phẩm sẵn sàng giao và lắp đặt</p>
          </div>
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <span className="small muted hide-sm">Sắp xếp:</span>
            <select
              className="input"
              style={{ width: "auto", minWidth: 150 }}
              value={sort}
              onChange={(e) => {
                playTap(700, 0.03);
                setSort(e.target.value);
              }}
              aria-label="Sắp xếp sản phẩm"
            >
              <option value="popular">Bán chạy nhất</option>
              <option value="sale">Giảm giá nhiều nhất</option>
              <option value="asc">Giá thấp đến cao</option>
              <option value="desc">Giá cao đến thấp</option>
            </select>
          </div>
        </div>

        {list.length ? (
          <div className="product-grid">
            {list.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <div className="panel">
            <Empty title="Không có sản phẩm phù hợp">
              Thử bỏ bớt bộ lọc hoặc tìm kiếm bằng từ khoá khác.
            </Empty>
          </div>
        )}
      </section>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<Loading message="Đang tải danh mục sản phẩm…" />}>
      <Catalog />
    </Suspense>
  );
}
