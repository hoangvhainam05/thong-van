"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PAYMENT_METHOD, useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { addDays, dateLabel, vnd, ymd } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import LocationPicker from "@/components/LocationPicker";
import { Empty, Field, Loading } from "@/components/ui";

const WINDOWS = [
  { id: "am", label: "Buổi sáng", start: "08:00", end: "12:00" },
  { id: "pm", label: "Buổi chiều", start: "13:00", end: "17:00" },
  { id: "day", label: "Cả ngày", start: "08:00", end: "17:00", hint: "Linh hoạt nhất, dễ xếp tuyến" },
  { id: "custom", label: "Tự chọn giờ" },
];

function Checkout() {
  const { state, user, actions, catalogStatus, shippingStatus } = useStore();
  const router = useRouter();
  const customer = state.customers.find((c) => c.id === user.customerId);
  const [addrId, setAddrId] = useState(customer?.addresses?.[0]?.id ?? "new");
  const [newAddr, setNewAddr] = useState({ address: "", district: "", lat: "", lng: "" });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const searchTimeoutRef = useRef(null);

  const onAddressChange = (val) => {
    if (!val || !val.trim()) {
      setNewAddr({ address: "", district: "", lat: "", lng: "" });
      setSuggestions([]);
      return;
    }
    setNewAddr((prev) => ({ ...prev, address: val }));
    clearTimeout(searchTimeoutRef.current);
    if (val.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const data = await api(`/api/location/geocode?q=${encodeURIComponent(val.trim())}`);
        if (Array.isArray(data)) setSuggestions(data.slice(0, 5));
      } catch {
        setSuggestions([]);
      }
    }, 350);
  };

  const selectSuggestion = (item) => {
    setNewAddr({
      address: item.display_name || "",
      district: item.address?.city_district || item.address?.district || item.address?.county || "",
      lat: Number(item.lat),
      lng: Number(item.lon),
    });
    setSuggestions([]);
    setPickerOpen(true);
  };

  const onAddressBlur = () => {
    setTimeout(() => setSuggestions([]), 250);
  };
  const [date, setDate] = useState(addDays(ymd(), 1));
  const [win, setWin] = useState("day");
  const [custom, setCustom] = useState({ start: "09:00", end: "11:00" });
  const [pay, setPay] = useState("COD");
  const [note, setNote] = useState("");
  const [addressNote, setAddressNote] = useState("");
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

  if (catalogStatus === 'loading' || shippingStatus === 'loading') return <Loading />;
  if (catalogStatus !== 'ready' || shippingStatus !== 'ready') return <div className="notice bad">Không tải được sản phẩm hoặc phí giao hàng. Vui lòng tải lại trang.</div>;

  const lines = state.cart.map((l) => ({ ...l, p: state.products.find((x) => x.id === l.productId) })).filter((line) => line.p);
  if (!lines.length) return <div className="panel"><Empty title="Giỏ hàng đang trống" action={<Link href="/products" className="btn">Chọn sản phẩm</Link>} /></div>;
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const ship = subtotal >= state.settings.freeShipFrom ? 0 : state.settings.shippingFee;
  const bankAvailable = Boolean(bankInstructions?.configured);
  const paymentChoice = pay === "BANK" && !bankAvailable ? "COD" : pay;
  const days = Array.from({ length: 7 }, (_, i) => addDays(ymd(), i));

  const submit = async () => {
    if (submitting) return;
    setError("");
    let address;
    if (addrId === "new") {
      if (newAddr.address.trim().length < 5) return setError("Vui lòng nhập địa chỉ giao hàng.");
      if (!newAddr.lat || !newAddr.lng) {
        setPickerOpen(true);
        return setError("Bắt buộc phải ghim vị trí trên bản đồ để lấy toạ độ giao hàng chính xác.");
      }
      address = { address: newAddr.address, district: newAddr.district, lat: Number(newAddr.lat), lng: Number(newAddr.lng) };
    } else {
      address = customer.addresses.find((a) => a.id === addrId);
      if (!address?.lat || !address?.lng) {
        setPickerOpen(true);
        return setError("Địa chỉ này chưa có toạ độ ghim trên bản đồ. Vui lòng ghim vị trí để tài xế giao hàng chính xác.");
      }
    }
    const w = win === "custom" ? custom : WINDOWS.find((x) => x.id === win);
    if (isGift && (!recipientName.trim() || !/^0\d{9,10}$/.test(recipientPhone))) {
      return setError("Nhập tên người nhận và số điện thoại hợp lệ cho đơn đặt hộ.");
    }
    const deliveryNote = [addrId === "new" && addressNote.trim() ? `Chú thích địa chỉ: ${addressNote.trim()}` : "", note.trim()].filter(Boolean).join(" · ");
    if (deliveryNote.length > 255) return setError("Chú thích địa chỉ và ghi chú cho tài xế không được vượt quá 255 ký tự.");
    setSubmitting(true);
    requestIdRef.current ||= crypto.randomUUID();
    const order = await actions.placeOrder({
      address,
      deliveryDate: date,
      window: { start: w.start, end: w.end },
      paymentMethod: paymentChoice,
      note: deliveryNote,
      isGift,
      recipientName,
      recipientPhone,
      clientRequestId: requestIdRef.current,
    });
    setSubmitting(false);
    if (order) {
      requestIdRef.current = null;
      router.push(`/account/orders/${order.serverId}?new=1`);
    }
  };

  return (
    <>
      {pickerOpen && (
        <LocationPicker
          initial={addrId === "new" ? newAddr : (customer?.addresses?.find((a) => a.id === addrId) || newAddr)}
          onClose={() => setPickerOpen(false)}
          onSelect={(location) => {
            setNewAddr((prev) => ({
              ...prev,
              ...location,
              address: location.address || (addrId === "new" ? prev.address : customer?.addresses?.find((a) => a.id === addrId)?.address) || "",
              district: location.district || prev.district || "",
            }));
            setAddrId("new");
            setPickerOpen(false);
            setError("");
          }}
        />
      )}
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
              {customer?.addresses?.length > 0 && (
                <div className="choice">
                  {customer.addresses.map((a) => {
                    const hasCoords = a.lat && a.lng;
                    return (
                      <label key={a.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                          <input type="radio" name="addr" checked={addrId === a.id} onChange={() => setAddrId(a.id)} />
                          <span>
                            <b>{a.label}</b>
                            {hasCoords ? (
                              <span className="tiny" style={{ color: "var(--go)", marginLeft: 8, fontWeight: 600 }}>✓ Đã có toạ độ</span>
                            ) : (
                              <span className="tiny" style={{ color: "var(--stop)", marginLeft: 8, fontWeight: 600 }}>⚠ Chưa ghim toạ độ</span>
                            )}
                            <br /><span className="small muted">{a.address}</span>
                          </span>
                        </div>
                        {!hasCoords && addrId === a.id && (
                          <button
                            type="button"
                            className="btn sm signal"
                            onClick={() => {
                              setNewAddr({ address: a.address, district: a.district || "", lat: "", lng: "" });
                              setAddrId("new");
                              setPickerOpen(true);
                            }}
                          >
                            📍 Ghim toạ độ
                          </button>
                        )}
                      </label>
                    );
                  })}
                  <label>
                    <input type="radio" name="addr" checked={addrId === "new"} onChange={() => setAddrId("new")} />
                    <span><b>Địa chỉ khác / Ghim vị trí mới</b></span>
                  </label>
                </div>
              )}

              {addrId !== "new" && (() => {
                const selected = customer?.addresses?.find((a) => a.id === addrId);
                const hasCoords = selected?.lat && selected?.lng;
                if (!selected) return null;
                return (
                  <div style={{ marginTop: 4 }}>
                    {hasCoords ? (
                      <div style={{ padding: "10px 14px", background: "#ecfdf5", border: "1px solid #10b981", borderRadius: "var(--r-sm)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "#065f46" }}>
                            ✓ Đã có toạ độ ghim GPS ({Number(selected.lat).toFixed(4)}, {Number(selected.lng).toFixed(4)})
                          </div>
                          <div className="tiny" style={{ color: "#047857", marginTop: 2 }}>
                            Tài xế sẽ được dẫn đường bằng GPS đến chính xác vị trí này.
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn sm secondary"
                          onClick={() => {
                            setNewAddr({ address: selected.address, district: selected.district || "", lat: selected.lat, lng: selected.lng });
                            setAddrId("new");
                            setPickerOpen(true);
                          }}
                        >
                          📍 Xem / Chỉnh lại ghim
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1px dashed #d97706", borderRadius: "var(--r-sm)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "#92400e" }}>
                            ⚠ Địa chỉ này chưa có toạ độ ghim trên bản đồ (Bắt buộc)
                          </div>
                          <div className="tiny" style={{ color: "#78350f", marginTop: 2 }}>
                            Vui lòng ghim vị trí để tài xế tìm đúng nhà bạn khi giao hàng.
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn sm signal"
                          onClick={() => {
                            setNewAddr({ address: selected.address, district: selected.district || "", lat: "", lng: "" });
                            setAddrId("new");
                            setPickerOpen(true);
                          }}
                        >
                          📍 Mở bản đồ để ghim ngay
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}

              {addrId === "new" && (
                <div className="form-grid">
                  <div className="field full" style={{ position: "relative" }}>
                    <span>Địa chỉ nhận hàng <span style={{ color: "var(--stop)" }}>*</span></span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        className="input grow"
                        value={newAddr.address}
                        onChange={(e) => onAddressChange(e.target.value)}
                        onBlur={onAddressBlur}
                        placeholder="Nhập tên xã, huyện, đường hoặc số nhà..."
                      />
                      <button
                        type="button"
                        className={`btn ${newAddr.lat ? "secondary" : "signal"}`}
                        onClick={() => setPickerOpen(true)}
                        style={{ whiteSpace: "nowrap" }}
                      >
                        📍 {newAddr.lat ? "Chỉnh vị trí ghim" : "Ghim trên bản đồ *"}
                      </button>
                    </div>
                    {suggestions.length > 0 && (
                      <div className="map-results" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 30, background: "#fff", boxShadow: "0 6px 18px rgba(0,0,0,0.18)", marginTop: 4, maxHeight: 180, overflowY: "auto", borderRadius: "var(--r-sm)" }}>
                        {suggestions.map((item) => (
                          <button
                            type="button"
                            key={item.place_id || `${item.lat},${item.lon}`}
                            onMouseDown={() => selectSuggestion(item)}
                            style={{ textAlign: "left", width: "100%", padding: "9px 12px", border: 0, borderBottom: "1px solid var(--line-soft)", background: "transparent", cursor: "pointer", display: "block" }}
                          >
                            <div className="small strong">{item.display_name}</div>
                            {item.address?.district && <div className="tiny muted">{item.address.district}</div>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="field full">
                    {newAddr.lat && newAddr.lng ? (
                      <div style={{ padding: "10px 14px", background: "#ecfdf5", border: "1px solid #10b981", borderRadius: "var(--r-sm)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "#065f46", display: "flex", alignItems: "center", gap: 6 }}>
                            <span>✓ Đã ghim toạ độ GPS chính xác</span>
                            <span className="tiny font-normal muted">({Number(newAddr.lat).toFixed(5)}, {Number(newAddr.lng).toFixed(5)})</span>
                          </div>
                          <div className="tiny" style={{ color: "#047857", marginTop: 2 }}>
                            Toạ độ GPS này sẽ dùng để dẫn đường cho tài xế đến đúng vị trí nhà bạn.
                          </div>
                        </div>
                        <button type="button" className="btn sm secondary" onClick={() => setPickerOpen(true)}>
                          📍 Chỉnh lại ghim
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: "10px 14px", background: "#fffbeb", border: "1px dashed #d97706", borderRadius: "var(--r-sm)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: "#92400e" }}>
                            ⚠ Bắt buộc ghim vị trí trên bản đồ
                          </div>
                          <div className="tiny" style={{ color: "#78350f", marginTop: 2 }}>
                            Vui lòng mở bản đồ để ghim đúng vị trí nhà bạn (đặc biệt khu vực không có số nhà).
                          </div>
                        </div>
                        <button type="button" className="btn sm signal" onClick={() => setPickerOpen(true)}>
                          📍 Mở bản đồ để ghim (Bắt buộc)
                        </button>
                      </div>
                    )}
                  </div>

                  <Field label="Chú thích địa chỉ" hint="Ví dụ: đối diện cây xăng, nhà cổng xanh, trong ngõ">
                    <input className="input" maxLength={220} value={addressNote} onChange={(e) => setAddressNote(e.target.value)} placeholder="Thông tin giúp tìm địa chỉ dễ hơn" />
                  </Field>
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
                    <input type="radio" name="pay" checked={paymentChoice === k} onChange={() => setPay(k)} />
                    <span><b>{label}</b><br /><span className="small muted">{k === "COD" ? "Trả cho tài xế khi nhận và kiểm tra hàng" : "Tạo đơn chờ chuyển khoản; nhân viên xác nhận sau khi đối soát"}</span></span>
                  </label>
                ))}
              </div>
              {paymentChoice === "BANK" && bankInstructions?.configured && <div className="notice" style={{ marginTop: 12 }}>Chuyển khoản tới <b>{bankInstructions.bank_name}</b> · {bankInstructions.account_name} · {bankInstructions.account_number}. Mã đơn và nội dung chuyển khoản sẽ hiện sau khi tạo đơn. Nhân viên sẽ đối soát thủ công.</div>}
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
