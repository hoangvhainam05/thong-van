"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { vnd } from "@/lib/format";
import Art from "./Art";

export default function ProductCard({ p }) {
  const { actions } = useStore();
  const off = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
  return (
    <article className="product-card">
      <Link href={`/products/${p.id}`} className="art-box" aria-label={p.name}>
        {off > 0 && <span className="sale">−{off}%</span>}
        {p.imageUrl ? <img src={p.imageUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <Art category={p.category} />}
      </Link>
      <div className="body">
        <Link href={`/products/${p.id}`} className="name">{p.name}</Link>
        <div className="meta">
          {p.install > 0 ? `Lắp đặt tại nhà ~${p.install} phút` : "Giao nhanh, không cần lắp"} · ★ {p.rating}
        </div>
        <div className="foot">
          <div>
            {p.oldPrice && <div className="strike">{vnd(p.oldPrice)}</div>}
            <div className="price">{vnd(p.price)}</div>
          </div>
          <button className="btn sm" disabled={!p.stock} onClick={() => actions.addToCart(p.id)}>
            {p.stock ? "Thêm vào giỏ" : "Hết hàng"}
          </button>
        </div>
      </div>
    </article>
  );
}
