"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { vnd } from "@/lib/format";
import Art from "./Art";
import TiltCard from "./TiltCard";
import { playSuccess, playTap } from "@/lib/audio-juice";

export default function ProductCard({ p }) {
  const { actions } = useStore();
  const off = p.oldPrice ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

  const handleAddToCart = () => {
    actions.addToCart(p.id);
    playSuccess();
  };

  return (
    <TiltCard as="article" className="product-card" maxTilt={6}>
      <Link
        href={`/products/${p.id}`}
        className="art-box"
        aria-label={p.name}
        onClick={() => playTap(750, 0.04)}
      >
        {off > 0 && <span className="sale">−{off}%</span>}
        {p.imageUrl ? (
          <img
            src={p.imageUrl}
            alt={p.name}
            loading="lazy"
            decoding="async"
            style={{ width: "100%", height: "100%", objectFit: "contain", transition: "transform 0.3s ease" }}
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
        <div className="meta">
          {p.install > 0 ? `Lắp đặt tại nhà ~${p.install} phút` : "Giao nhanh, không cần lắp"} · ★ {p.rating}
        </div>
        <div className="foot">
          <div>
            {p.oldPrice && <div className="strike">{vnd(p.oldPrice)}</div>}
            <div className="price">{vnd(p.price)}</div>
          </div>
          <button
            className="btn sm"
            disabled={!p.stock}
            onClick={handleAddToCart}
          >
            {p.stock ? "Thêm vào giỏ" : "Hết hàng"}
          </button>
        </div>
      </div>
    </TiltCard>
  );
}
