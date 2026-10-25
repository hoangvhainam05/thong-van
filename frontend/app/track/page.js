"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { api, vnd } from "@/lib/api";
import { dateLabel } from "@/lib/format";
import OrderTracking from "@/components/OrderTracking";
import { Field, Loading, OrderBadge } from "@/components/ui";

function Tracker() {
  const { ready, state } = useStore();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [phone, setPhone] = useState(params.get("phone") || "");
  const [found, setFound] = useState(null);
  const [remote, setRemote] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  if (!ready) return <Loading />;

  const lookup = async (e) => {
    e?.preventDefault();
    const normalizedCode = code.trim().toUpperCase();
    const normalizedPhone = phone.replace(/\s/g, "");
    if (!normalizedCode || !normalizedPhone) {
      setFound(null);
      setRemote(null);
      setError("Nhập cả mã đơn và số điện thoại đã dùng khi đặt hàng.");
      return;
    }
    setLoading(true);
    setError("");
    setFound(null);
    setRemote(null);
    try {
      const tracking = await api(`/api/tracking/${encodeURIComponent(normalizedCode)}?phone=${encodeURIComponent(normalizedPhone)}`);
      setRemote(tracking);
    } catch (lookupError) {
      if (lookupError.status === 404) {
        setError("Không tìm thấy đơn với mã và số điện thoại này. Kiểm tra lại tin nhắn xác nhận đơn.");
      } else if (!lookupError.status) {
        const local = state.orders.find((x) => x.code === normalizedCode && x.phone === normalizedPhone);
        if (local) setFound(local.id);
        else setError("Chưa kết nối được máy chủ tra cứu. Thử lại sau ít phút.");
      } else {
        setError("Máy chủ chưa thể tra cứu đơn lúc này. Thử lại sau ít phút.");
      }
    } finally {
      setLoading(false);
    }
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
        <button className="btn" disabled={loading}>{loading ? "Đang tra cứu…" : "Tra cứu"}</button>
      </form>
      {sample && !order && !remote && (
        <p className="small muted">
          Thử với đơn mẫu:{" "}
          <button className="btn ghost sm" onClick={() => { setCode(sample.code); setPhone(sample.phone); }}>{sample.code} / {sample.phone}</button>
        </p>
      )}
      {error && <div className="notice bad">{error}</div>}
      {order && <OrderTracking order={order} />}
      {remote && <RemoteTracking tracking={remote} />}
    </div>
  );
}

function RemoteTracking({ tracking }) {
  const time = (value) => value ? new Date(value).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) : "—";
  const instructions = tracking.payment_instructions;
  return (
    <div className="two-col">
      <div className="stack">
        <section className="panel panel-pad stack">
          <div className="row between"><div><div className="small muted">Đơn {tracking.code} · giao {dateLabel(tracking.delivery_date)} · khung {tracking.time_window}</div><h2 style={{ fontSize: 24, marginTop: 6 }}>{tracking.message}</h2></div><OrderBadge status={tracking.status} /></div>
          {tracking.position != null && <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
            <div className="kpi"><div className="label">Vị trí trong tuyến</div><div className="value">#{tracking.position}</div></div>
            <div className="kpi"><div className="label">Điểm còn lại</div><div className="value">{tracking.total_stops}</div></div>
            <div className="kpi"><div className="label">Dự kiến xe tới</div><div className="value" style={{ fontSize: 20 }}>{time(tracking.eta_start)} – {time(tracking.eta_end)}</div></div>
          </div>}
          {tracking.requested_info?.length > 0 && <div className="notice warn stack-sm"><b>Cửa hàng cần bạn bổ sung thông tin</b>{tracking.requested_info.map((item, i) => <div key={`${item.at}-${i}`}>{item.message}</div>)}</div>}
          {tracking.route_locked === false && tracking.position != null && <div className="notice warn">Lịch giao đang được sắp xếp; thứ tự có thể điều chỉnh trước khi chốt tuyến.</div>}
        </section>
        <section className="panel panel-pad">
          <h3 style={{ marginBottom: 14 }}>Tiến trình đơn</h3>
          <ul className="timeline">{tracking.timeline.map((item) => <li key={item.status} className={item.state}><span className="dot" /><div className="t-title">{item.label}</div></li>)}</ul>
        </section>
      </div>
      <aside className="stack">
        {tracking.payment_method === "BANK_TRANSFER" && tracking.payment_status === "PENDING" && <section className="panel panel-pad stack-sm small">
          <h3>Hướng dẫn chuyển khoản</h3>
          {instructions?.configured ? <>
            <div><span className="muted">Ngân hàng</span><br /><b>{instructions.bank_name}</b></div>
            <div><span className="muted">Tên tài khoản</span><br /><b>{instructions.account_name}</b></div>
            <div><span className="muted">Số tài khoản</span><br /><b>{instructions.account_number}</b></div>
            <div><span className="muted">Số tiền</span><br /><b className="price">{vnd(instructions.amount)}</b></div>
            <div><span className="muted">Nội dung</span><br /><b>{instructions.transfer_content}</b></div>
            <p className="tiny muted">Đơn được xác nhận sau khi nhân viên đối soát tiền về tài khoản.</p>
          </> : <div className="notice warn">Cửa hàng chưa cấu hình thông tin nhận chuyển khoản. Vui lòng liên hệ cửa hàng.</div>}
        </section>}
        <section className="panel panel-pad stack-sm small"><h3>Thanh toán</h3><div>{tracking.payment_method === "BANK_TRANSFER" ? "Chuyển khoản" : tracking.payment_method === "COUNTER_CASH" ? "Tiền mặt tại quầy" : "Tiền mặt khi nhận"} · {tracking.payment_status === "PAID" ? "Đã thanh toán" : tracking.payment_status === "PENDING" ? "Chờ chuyển khoản" : "Chưa thanh toán"}</div></section>
      </aside>
    </div>
  );
}

export default function TrackPage() {
  return <Suspense fallback={<Loading />}><Tracker /></Suspense>;
}
