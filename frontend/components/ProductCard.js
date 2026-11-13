"use client";

import Link from "next/link";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { vnd } from "@/lib/format";
import Art from "./Art";
import TiltCard from "./TiltCard";
import { playSuccess, playTap } from "@/lib/audio-juice";
import { ShoppingCart, Check, Wrench, Star } from "lucide-react";

export default function ProductCard({ p }) {
  const { actions } = useStore();
  const [added, setAdded] = useState(false);
  const off = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

  const handleAddToCart = () => {
    actions.addToCart(p.id);
    playSuccess();
    setAdded(true);
    setTimeout(() => setAdded(false), 1400);
  };

  return (
    <TiltCard as="article" className="product-card" maxTilt={6}>
      <Link
        href={`/products/${p.id}`}
        className="art-box"
        aria-label={p.name}
        onClick={() => playTap(750, 0.04)}
      >
        {off > 0 && <span className="sale shimmer-badge">−{off}%</span>}
        {p.imageUrl ? (
          <img
            src={p.imageUrl}
            alt={p.name}
            loading="lazy"
            decoding="async"
            className="product-img"
          />
        ) : (
          <Art category={p.category} />
        )}
      </Link>
      <div className="body">
        <Link
          href={`/products/${p.id}`}
          className="name"
          onClick={() => playTap(750, 0.04)}
        >
          {p.name}
        </Link>
        <div className="meta row" style={{ gap: 6, alignItems: "center" }}>
          {p.install > 0 ? (
            <span className="spec-pill" title="Có hỗ trợ lắp đặt tại nhà">
              <Wrench size={12} strokeWidth={2.2} /> Lắp ~{p.install}p
            </span>
          ) : (
            <span className="spec-pill subtle">Giao nhanh</span>
          )}
          <span className="rating-pill">
            <Star size={11} fill="#f59e0b" color="#f59e0b" /> {p.rating}
          </span>
          {p.sold > 0 && <span className="small muted">· Đã bán {p.sold}</span>}
        </div>
        <div className="foot">
          <div>
            {p.oldPrice && <div className="strike">{vnd(p.oldPrice)}</div>}
            <div className="price">{vnd(p.price)}</div>
          </div>
          <button
            className={`btn sm ${added ? "btn-added" : ""}`}
            disabled={!p.stock}
            onClick={handleAddToCart}
            aria-label={added ? "Đã thêm vào giỏ hàng" : "Thêm vào giỏ"}
          >
            {added ? (
              <>
                <Check size={14} strokeWidth={2.5} /> Đã thêm
              </>
            ) : p.stock ? (
              <>
                <ShoppingCart size={14} /> Thêm giỏ
              </>
            ) : (
              "Hết hàng"
            )}
          </button>
        </div>
      </div>
    </TiltCard>
  );
}
