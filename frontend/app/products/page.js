"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/mock/catalog";
import ProductCard from "@/components/ProductCard";
import { Empty, Loading } from "@/components/ui";

const PRICE = [
  ["all", "Mọi mức giá"],
  ["0-5", "Dưới 5 triệu"],
  ["5-10", "5 – 10 triệu"],
  ["10-20", "10 – 20 triệu"],
  ["20-999", "Trên 20 triệu"],
];

function Catalog() {
  const { ready, state } = useStore();
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

  if (!ready) return <Loading />;
  const allBrands = [...new Set(state.products.filter((p) => !cat || p.category === cat).map((p) => p.brand))].sort();
  const title = q ? `Kết quả cho “${q}”` : CATEGORIES.find((c) => c.id === cat)?.name || "Tất cả sản phẩm";

  return (
    <div className="shop-layout">
      <aside className="panel panel-pad filter-box stack">
        <div className="stack-sm">
          <h3>Hãng</h3>
          {allBrands.map((b) => (
            <label key={b} className="check">
              <input type="checkbox" checked={brands.includes(b)} onChange={(e) => setBrands((x) => (e.target.checked ? [...x, b] : x.filter((y) => y !== b)))} />
              {b}
            </label>
          ))}
        </div>
        <div className="divider" />
        <div className="stack-sm">
          <h3>Mức giá</h3>
          {PRICE.map(([v, l]) => (
            <label key={v} className="check">
              <input type="radio" name="price" checked={price === v} onChange={() => setPrice(v)} />
              {l}
            </label>
          ))}
        </div>
        {(brands.length > 0 || price !== "all" || q) && (
          <button className="btn secondary sm" onClick={() => { setBrands([]); setPrice("all"); if (q) router.push(cat ? `/products?cat=${cat}` : "/products"); }}>
            Bỏ lọc
          </button>
        )}
      </aside>
      <section>
        <div className="row between" style={{ marginBottom: 14 }}>
          <div>
            <h1 style={{ fontSize: 24 }}>{title}</h1>
            <p className="small muted">{list.length} sản phẩm</p>
          </div>
          <select className="input" style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sắp xếp">
            <option value="popular">Bán chạy</option>
            <option value="sale">Giảm nhiều</option>
            <option value="asc">Giá thấp đến cao</option>
            <option value="desc">Giá cao đến thấp</option>
          </select>
        </div>
        {list.length ? (
          <div className="product-grid">{list.map((p) => <ProductCard key={p.id} p={p} />)}</div>
        ) : (
          <div className="panel"><Empty title="Không có sản phẩm phù hợp">Thử bỏ bớt bộ lọc hoặc tìm bằng từ khoá khác.</Empty></div>
        )}
      </section>
    </div>
  );
}

export default function ProductsPage() {
  return <Suspense fallback={<Loading />}><Catalog /></Suspense>;
}
