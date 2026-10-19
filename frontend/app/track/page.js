"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import OrderTracking from "@/components/OrderTracking";
import { Field, Loading } from "@/components/ui";

function Tracker() {
  const { ready, state } = useStore();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [phone, setPhone] = useState(params.get("phone") || "");
  const [found, setFound] = useState(null);
  const [error, setError] = useState("");
  if (!ready) return <Loading />;

  const lookup = (e) => {
    e?.preventDefault();
    const o = state.orders.find((x) => x.code === code.trim().toUpperCase());
    // Sai mã hay sai số điện thoại đều báo giống nhau để không dò được đơn của người khác
    if (!o || o.phone !== phone.replace(/\s/g, "")) {
      setFound(null);
      setError("Không tìm thấy đơn với mã và số điện thoại này. Kiểm tra lại tin nhắn xác nhận đơn.");
      return;
    }
    setError("");
    setFound(o.id);
  };
  const order = found ? state.orders.find((o) => o.id === found) : null;
  const sample = state.orders.find((o) => o.customerId === 1 && o.status === "OUT_FOR_DELIVERY");

  return (
    <div className="stack">
      <div>
        <h1>Tra cứu đơn hàng</h1>
        <p className="muted" style={{ marginTop: 4 }}>Không cần đăng nhập. Nhập mã đơn và số điện thoại đã dùng khi đặt hàng.</p>
      </div>
      <form className="panel panel-pad row" style={{ alignItems: "flex-end" }} onSubmit={lookup}>
        <div className="grow"><Field label="Mã đơn"><input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="TV101435" /></Field></div>
        <div className="grow"><Field label="Số điện thoại"><input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xx xxx xxx" inputMode="tel" /></Field></div>
        <button className="btn">Tra cứu</button>
      </form>
      {sample && !order && (
        <p className="small muted">
          Thử với đơn mẫu:{" "}
          <button className="btn ghost sm" onClick={() => { setCode(sample.code); setPhone(sample.phone); }}>{sample.code} / {sample.phone}</button>
        </p>
      )}
      {error && <div className="notice bad">{error}</div>}
      {order && <OrderTracking order={order} />}
    </div>
  );
}

export default function TrackPage() {
  return <Suspense fallback={<Loading />}><Tracker /></Suspense>;
}
