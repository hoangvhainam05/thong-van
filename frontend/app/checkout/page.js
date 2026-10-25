"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PAYMENT_METHOD, useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { addDays, dateLabel, vnd, ymd } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import { Empty, Field } from "@/components/ui";

const WINDOWS = [
  { id: "am", label: "Buổi sáng", start: "08:00", end: "12:00" },
  { id: "pm", label: "Buổi chiều", start: "13:00", end: "17:00" },
  { id: "day", label: "Cả ngày", start: "08:00", end: "17:00", hint: "Linh hoạt nhất, dễ xếp tuyến" },
  { id: "custom", label: "Tự chọn giờ" },
];

function Checkout() {
  const { state, user, actions } = useStore();
  const router = useRouter();
  const customer = state.customers.find((c) => c.id === user.customerId);
  const [addrId, setAddrId] = useState(customer?.addresses[0]?.id ?? "new");
  const [newAddr, setNewAddr] = useState({ address: "", district: "", lat: "", lng: "" });
  const [date, setDate] = useState(addDays(ymd(), 1));
  const [win, setWin] = useState("day");
  const [custom, setCustom] = useState({ start: "09:00", end: "11:00" });
  const [pay, setPay] = useState("COD");
  const [note, setNote] = useState("");
  const [isGift, setIsGift] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const requestIdRef = useRef(null);
  const [bankInstructions, setBankInstructions] = useState(null);

  useEffect(() => {
    api("/api/orders/payment-instructions")
      .then(setBankInstructions)
      .catch(() => setBankInstructions({ configured: false }));
  }, []);

  const lines = state.cart.map((l) => ({ ...l, p: state.products.find((x) => x.id === l.productId) }));
  if (!lines.length) return <div className="panel"><Empty title="Giỏ hàng đang trống" action={<Link href="/products" className="btn">Chọn sản phẩm</Link>} /></div>;
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const ship = subtotal >= state.settings.freeShipFrom ? 0 : state.settings.shippingFee;
  const codAllowed = !isGift && subtotal + ship < 10_000_000;
  const bankAvailable = Boolean(bankInstructions?.configured);
  const paymentChoice = codAllowed ? (pay === "BANK" && !bankAvailable ? "COD" : pay) : (bankAvailable ? "BANK" : null);
  const days = Array.from({ length: 7 }, (_, i) => addDays(ymd(), i));

  const locate = () => {
    if (!navigator.geolocation) return setError("Trình duyệt không hỗ trợ lấy vị trí.");
    navigator.geolocation.getCurrentPosition(
      (pos) => setNewAddr((a) => ({ ...a, lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6) })),
      () => setError("Không lấy được vị trí. Cửa hàng sẽ xác định vị trí khi gọi xác nhận đơn.")
    );
  };

  const submit = async () => {
    if (submitting) return;
    setError("");
    if (!paymentChoice) return setError("Đơn này không áp dụng COD và cửa hàng chưa cấu hình tài khoản chuyển khoản.");
    let address;
    if (addrId === "new") {
      if (newAddr.address.trim().length < 8) return setError("Nhập địa chỉ giao hàng đầy đủ (số nhà, đường, phường, quận).");
      address = { address: newAddr.address, district: newAddr.district, lat: newAddr.lat ? Number(newAddr.lat) : null, lng: newAddr.lng ? Number(newAddr.lng) : null };
    } else address = customer.addresses.find((a) => a.id === addrId);
    const w = win === "custom" ? custom : WINDOWS.find((x) => x.id === win);
    if (isGift && (!recipientName.trim() || !/^0\d{9,10}$/.test(recipientPhone))) {
      return setError("Nhập tên người nhận và số điện thoại hợp lệ cho đơn đặt hộ.");
    }
    setSubmitting(true);
    requestIdRef.current ||= crypto.randomUUID();
    const order = await actions.placeOrder({
      address,
      deliveryDate: date,
      window: { start: w.start, end: w.end },
      paymentMethod: paymentChoice,
      note,
      isGift,
      recipientName,
      recipientPhone,
      clientRequestId: requestIdRef.current,
    });
    setSubmitting(false);
    if (order) {
      requestIdRef.current = null;
      router.push(`/account/orders/${order.id}?new=1`);
    }
  };

  return (
    <>
      <div className="steps-bar"><span>Giỏ hàng</span><span>›</span><span className="on">Giao hàng và thanh toán</span><span>›</span><span>Theo dõi đơn</span></div>
      <h1 style={{ marginBottom: 18 }}>Đặt hàng</h1>
      <div className="two-col">
        <div className="stack">
          <section className="panel">
            <div className="panel-head"><h3>Thông tin người đặt</h3></div>
            <div className="panel-body stack-sm">
              <div><b>{customer.name}</b><div className="small muted">{customer.phone}</div></div>
              <label className="row small" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={isGift} onChange={(e) => setIsGift(e.target.checked)} />
                <span>Đặt hộ / giao quà cho người khác</span>
              </label>
              {isGift && <div className="form-grid">
                <Field label="Tên người nhận"><input className="input" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} /></Field>
                <Field label="Số điện thoại người nhận"><input className="input" inputMode="tel" value={recipientPhone} onChange={(e) => setRecipientPhone(e.target.value)} /></Field>
              </div>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h3>Địa chỉ nhận hàng</h3></div>
            <div className="panel-body stack">
              <div className="choice">
                {customer.addresses.map((a) => (
                  <label key={a.id}>
                    <input type="radio" name="addr" checked={addrId === a.id} onChange={() => setAddrId(a.id)} />
                    <span><b>{a.label}</b><br /><span className="small muted">{a.address}</span></span>
                  </label>
                ))}
                <label>
                  <input type="radio" name="addr" checked={addrId === "new"} onChange={() => setAddrId("new")} />
                  <span><b>Địa chỉ khác</b></span>
                </label>
              </div>
              {addrId === "new" && (
                <div className="form-grid">
                  <Field label="Địa chỉ" full><input className="input" value={newAddr.address} onChange={(e) => setNewAddr({ ...newAddr, address: e.target.value })} placeholder="Số nhà, ngõ, đường, phường" /></Field>
                  <Field label="Quận / huyện"><input className="input" value={newAddr.district} onChange={(e) => setNewAddr({ ...newAddr, district: e.target.value })} /></Field>
                  <div className="field"><span>Vị trí trên bản đồ</span><button type="button" className="btn secondary" onClick={locate}>{newAddr.lat ? `Đã lấy: ${newAddr.lat}, ${newAddr.lng}` : "Dùng vị trí hiện tại"}</button></div>
                  <p className="small muted full">Có vị trí chính xác giúp xếp tuyến nhanh hơn. Nếu bỏ qua, nhân viên sẽ xác định khi gọi xác nhận.</p>
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h3>Ngày và khung giờ nhận hàng</h3></div>
            <div className="panel-body stack">
              <div className="row" role="radiogroup" aria-label="Ngày giao">
                {days.map((d) => (
                  <button key={d} type="button" role="radio" aria-checked={date === d} className={`btn sm ${date === d ? "" : "secondary"}`} onClick={() => setDate(d)}>{d <= addDays(ymd(), 1) ? dateLabel(d) : `${new Date(d + "T00:00").toLocaleDateString("vi-VN", { weekday: "short" })} ${d.slice(8)}/${d.slice(5, 7)}`}</button>
                ))}
              </div>
              <div className="choice" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
                {WINDOWS.map((w) => (
                  <label key={w.id}>
                    <input type="radio" name="win" checked={win === w.id} onChange={() => setWin(w.id)} />
                    <span><b>{w.label}</b><br /><span className="small muted">{w.start ? `${w.start} – ${w.end}` : "Tối thiểu 1 tiếng"}{w.hint ? `. ${w.hint}` : ""}</span></span>
                  </label>
                ))}
              </div>
              {win === "custom" && (
                <div className="form-grid">
                  <Field label="Từ"><input type="time" className="input" min="08:00" max="17:00" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} /></Field>
                  <Field label="Đến"><input type="time" className="input" min="09:00" max="18:00" value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} /></Field>
                </div>
              )}
              <Field label="Ghi chú cho tài xế"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ví dụ: gọi trước 30 phút, nhà trong ngõ nhỏ" /></Field>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h3>Thanh toán</h3></div>
            <div className="panel-body">
              <div className="choice">
                {Object.entries(PAYMENT_METHOD).filter(([k]) => !["EWALLET", "COUNTER_CASH"].includes(k) && (k !== "BANK" || bankAvailable)).map(([k, label]) => (
                  <label key={k}>
                    <input type="radio" name="pay" disabled={k === "COD" && !codAllowed} checked={paymentChoice === k} onChange={() => setPay(k)} />
                    <span><b>{label}</b><br /><span className="small muted">{k === "COD" ? (!codAllowed ? "Không áp dụng cho đơn đặt hộ hoặc đơn từ 10 triệu đồng" : "Trả cho tài xế khi nhận và kiểm tra hàng") : "Tạo đơn chờ chuyển khoản; nhân viên xác nhận sau khi đối soát"}</span></span>
                  </label>
                ))}
              </div>
              {paymentChoice === "BANK" && bankInstructions?.configured && <div className="notice" style={{ marginTop: 12 }}>Chuyển khoản tới <b>{bankInstructions.bank_name}</b> · {bankInstructions.account_name} · {bankInstructions.account_number}. Mã đơn và nội dung chuyển khoản sẽ hiện sau khi tạo đơn. Nhân viên sẽ đối soát thủ công.</div>}
              {!codAllowed && !bankAvailable && <div className="notice bad" style={{ marginTop: 12 }}>Đơn đặt hộ hoặc từ 10 triệu đồng cần chuyển khoản, nhưng cửa hàng chưa cấu hình tài khoản nhận tiền.</div>}
              {bankAvailable && <p className="tiny muted" style={{ marginTop: 10 }}>Website chưa tích hợp QR hoặc tự động đối soát. Vui lòng chuyển khoản đúng nội dung mã đơn.</p>}
            </div>
          </section>
        </div>

        <aside className="panel panel-pad stack" style={{ position: "sticky", top: 16 }}>
          <h3>Đơn hàng</h3>
          <div className="stack-sm small">
            {lines.map((l) => (
              <div key={l.productId} className="row between" style={{ alignItems: "flex-start" }}>
                <span className="grow">{l.p.name} × {l.qty}</span><span className="nowrap">{vnd(l.p.price * l.qty)}</span>
              </div>
            ))}
          </div>
          <div className="divider" />
          <div className="stack-sm small">
            <div className="row between"><span className="muted">Tạm tính</span><span>{vnd(subtotal)}</span></div>
            <div className="row between"><span className="muted">Phí giao hàng</span><span>{ship ? vnd(ship) : "Miễn phí"}</span></div>
          </div>
          <div className="row between"><b>Tổng cộng</b><span className="price" style={{ fontSize: 22 }}>{vnd(subtotal + ship)}</span></div>
          {error && <div className="notice bad">{error}</div>}
          <button className="btn lg block" disabled={submitting || !paymentChoice} onClick={submit}>
            {submitting ? "Đang tạo đơn…" : paymentChoice === "COD" ? "Đặt hàng" : "Tạo đơn chờ chuyển khoản"}
          </button>
          <p className="tiny muted">Giao {date <= addDays(ymd(), 1) ? dateLabel(date).toLowerCase() : `ngày ${dateLabel(date)}`}. Bạn sẽ thấy khung giờ dự kiến và vị trí trong tuyến sau khi cửa hàng xếp lịch.</p>
        </aside>
      </div>

    </>
  );
}

export default function CheckoutPage() {
  return <RequirePerm perm="order.place"><Checkout /></RequirePerm>;
}
