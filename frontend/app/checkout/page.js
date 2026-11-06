"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { PAYMENT_METHOD, useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { addDays, dateLabel, vnd, ymd } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import LocationPicker from "@/components/LocationPicker";
import { Empty, Field, Loading } from "@/components/ui";

const WINDOWS = [
  { id: "am", label: "Buổi sáng", start: "08:00", end: "12:00" },
  { id: "pm", label: "Buổi chiều", start: "13:00", end: "18:00" },
  { id: "day", label: "Cả ngày", start: "08:00", end: "18:00", hint: "Linh hoạt nhất, dễ xếp tuyến" },
  { id: "custom", label: "Tự chọn giờ" },
];

function formatDuration(minutes) {
  const totalMinutes = Math.max(0, Math.trunc(Number(minutes) || 0));
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  if (hours && remainingMinutes) return `${hours} giờ ${remainingMinutes} phút`;
  if (hours) return `${hours} giờ`;
  return `${remainingMinutes} phút`;
}

function Checkout() {
  const { state, user, actions, catalogStatus, shippingStatus } = useStore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customer = state.customers.find((c) => c.id === user?.customerId || c.authUserId === user?.id) || state.customers[0];
  const addresses = customer?.addresses || [];
  const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];

  const [addrId, setAddrId] = useState(defaultAddr?.id ?? "new");
  const [newAddr, setNewAddr] = useState({ address: "", district: "", lat: "", lng: "" });
  const [addrLabel, setAddrLabel] = useState("Nhà riêng");
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [setAsDefault, setSetAsDefault] = useState(addresses.length === 0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (addresses.length > 0) {
      if (addrId !== "new" && !addresses.some((a) => a.id === addrId)) {
        const def = addresses.find((a) => a.isDefault) || addresses[0];
        if (def) setAddrId(def.id);
      }
    } else {
      setAddrId("new");
      setSaveNewAddress(true);
      setSetAsDefault(true);
    }
  }, [addresses]);

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
  const [date, setDate] = useState(ymd());
  const [win, setWin] = useState("day");
  const [deliveryType, setDeliveryType] = useState("STANDARD");
  const [shippingQuote, setShippingQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
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

  let quoteProductIds = null;
  if (searchParams.has("items")) {
    try {
      const parsed = JSON.parse(searchParams.get("items"));
      quoteProductIds = new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch { quoteProductIds = new Set(); }
  }
  const quoteItems = (state?.cart || [])
    .filter((line) => !quoteProductIds || quoteProductIds.has(String(line.productId)))
    .map((line) => ({ product_id: line.productId, quantity: line.qty }));
  const quoteAddress = addrId === "new" ? newAddr : addresses.find((address) => address.id === addrId);
  const hasQuoteCoordinates = quoteAddress?.lat != null && quoteAddress?.lat !== "" && quoteAddress?.lng != null && quoteAddress?.lng !== "";
  const quotePayload = hasQuoteCoordinates && quoteItems.length ? {
    lat: Number(quoteAddress.lat), lng: Number(quoteAddress.lng), delivery_type: deliveryType, items: quoteItems,
  } : null;
  const quoteKey = quotePayload ? JSON.stringify(quotePayload) : "";

  useEffect(() => {
    if (!quoteKey) {
      setShippingQuote(null);
      setQuoteLoading(false);
      return undefined;
    }
    let cancelled = false;
    setShippingQuote(null);
    setQuoteLoading(true);
    const timer = setTimeout(() => {
      api("/api/orders/shipping-quote", { method: "POST", body: JSON.parse(quoteKey) })
        .then((quote) => { if (!cancelled) setShippingQuote(quote); })
        .catch((error) => { if (!cancelled) setShippingQuote({ quoteAvailable: false, reasons: [error.message] }); })
        .finally(() => { if (!cancelled) setQuoteLoading(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [quoteKey]);

  useEffect(() => {
    if (deliveryType === "STANDARD" && shippingQuote?.deliveryWindowDate && date < shippingQuote.deliveryWindowDate) {
      setDate(shippingQuote.deliveryWindowDate);
    }
  }, [deliveryType, shippingQuote?.deliveryWindowDate, date]);

  const etaClock = shippingQuote?.estimatedArrivalAt
    ? new Date(shippingQuote.estimatedArrivalAt).toLocaleTimeString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
    : "";
  const expressDescription = quoteLoading
    ? "Đang tính thời gian nhận hàng theo địa chỉ và kiện hàng…"
    : shippingQuote?.expressEligibility?.eligible
      ? `Nhận hàng dự kiến sau ${shippingQuote.estimatedDeliveryMinutes} phút, khoảng ${etaClock}. Nhận đơn đến trước 16:00.`
      : shippingQuote?.expressEligibility?.reasons?.join(" ") || "Chọn địa chỉ và ghim vị trí để xem ETA hỏa tốc. Nhận đơn đến trước 16:00.";
  const etaMinuteOfDay = etaClock ? Number(etaClock.slice(0, 2)) * 60 + Number(etaClock.slice(3, 5)) : 0;
  const isSelectedWindowTooEarly = (window) => deliveryType === "STANDARD" && date === shippingQuote?.deliveryWindowDate && etaClock && window.end && Number(window.end.slice(0, 2)) * 60 + Number(window.end.slice(3, 5)) < etaMinuteOfDay;

  useEffect(() => {
    if (deliveryType !== "STANDARD" || date !== shippingQuote?.deliveryWindowDate || !etaClock) return;
    const selected = win === "custom" ? custom : WINDOWS.find((window) => window.id === win);
    if (selected && isSelectedWindowTooEarly(selected)) setWin("day");
  }, [deliveryType, date, shippingQuote?.deliveryWindowDate, etaClock, win, custom]);

  if (catalogStatus === 'loading' || shippingStatus === 'loading') return <Loading />;
  if (catalogStatus !== 'ready' || shippingStatus !== 'ready') return <div className="notice bad">Không tải được sản phẩm hoặc phí giao hàng. Vui lòng tải lại trang.</div>;

  let requestedProductIds = null;
  const hasExplicitSelection = searchParams.has("items");
  if (hasExplicitSelection) {
    try {
      const parsed = JSON.parse(searchParams.get("items"));
      requestedProductIds = new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch {
      requestedProductIds = new Set();
    }
  }
  const cartLines = state.cart.map((l) => ({ ...l, p: state.products.find((x) => x.id === l.productId) })).filter((line) => line.p);
  const lines = cartLines.filter((line) => !requestedProductIds || requestedProductIds.has(String(line.productId)));
  if (!cartLines.length) return <div className="panel"><Empty title="Giỏ hàng đang trống" action={<Link href="/products" className="btn">Chọn sản phẩm</Link>} /></div>;
  if (!lines.length) return <div className="panel"><Empty title="Chưa chọn sản phẩm để thanh toán" action={<Link href="/cart" className="btn">Quay lại giỏ hàng</Link>} /></div>;
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const bankAvailable = Boolean(bankInstructions?.configured);
  const paymentChoice = pay === "BANK" && !bankAvailable ? "COD" : pay;
  const days = Array.from({ length: 7 }, (_, i) => addDays(ymd(), i));

  const submit = async () => {
    if (submitting) return;
    setError("");
    let address;
    const isNew = addrId === "new" || addresses.length === 0;
    if (isNew) {
      if (newAddr.address.trim().length < 5) return setError("Vui lòng nhập địa chỉ giao hàng.");
      if (!newAddr.lat || !newAddr.lng) {
        setPickerOpen(true);
        return setError("Bắt buộc phải ghim vị trí trên bản đồ để lấy toạ độ giao hàng chính xác.");
      }
      address = {
        label: addrLabel.trim() || "Nhà riêng",
        address: newAddr.address,
        district: newAddr.district,
        lat: Number(newAddr.lat),
        lng: Number(newAddr.lng),
      };
    } else {
      address = addresses.find((a) => a.id === addrId);
      if (!address?.lat || !address?.lng) {
        setPickerOpen(true);
        return setError("Địa chỉ này chưa có toạ độ ghim trên bản đồ. Vui lòng ghim vị trí để tài xế giao hàng chính xác.");
      }
    }
    if (!shippingQuote?.quoteAvailable || quoteLoading) {
      return setError(shippingQuote?.reasons?.join(" ") || "Đang tính phí giao hàng. Vui lòng đợi báo giá chính xác.");
    }
    if (deliveryType === "EXPRESS" && !shippingQuote.expressEligibility?.eligible) {
      return setError(shippingQuote.expressEligibility?.reasons?.join(" ") || "Đơn chưa đủ điều kiện giao hỏa tốc.");
    }
    const w = deliveryType === "EXPRESS" ? { start: "08:00", end: "18:00" } : win === "custom" ? custom : WINDOWS.find((x) => x.id === win);
    if (isGift && (!recipientName.trim() || !/^0\d{9,10}$/.test(recipientPhone))) {
      return setError("Nhập tên người nhận và số điện thoại hợp lệ cho đơn đặt hộ.");
    }
    const deliveryNote = [isNew && addressNote.trim() ? `Chú thích địa chỉ: ${addressNote.trim()}` : "", note.trim()].filter(Boolean).join(" · ");
    if (deliveryNote.length > 255) return setError("Chú thích địa chỉ và ghi chú cho tài xế không được vượt quá 255 ký tự.");
    setSubmitting(true);
    requestIdRef.current ||= crypto.randomUUID();
    const order = await actions.placeOrder({
      address,
      deliveryDate: date,
      deliveryType,
      window: { start: w.start, end: w.end },
      paymentMethod: paymentChoice,
      note: deliveryNote,
      isGift,
      recipientName,
      recipientPhone,
      clientRequestId: requestIdRef.current,
      saveAddress: isNew ? (addresses.length === 0 || saveNewAddress) : false,
      addressLabel: addrLabel.trim() || "Nhà riêng",
      isDefault: isNew ? (addresses.length === 0 || setAsDefault) : false,
      productIds: lines.map((line) => line.productId),
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
            <div className="panel-head"><h3>Phương thức giao hàng</h3></div>
            <div className="panel-body stack-sm">
              <div className="choice">
                <label>
                  <input type="radio" name="delivery-type" checked={deliveryType === "STANDARD"} onChange={() => setDeliveryType("STANDARD")} />
                  <span><b>Giao thường</b><br /><span className="small muted">Theo lịch giao phù hợp với thời gian chuẩn bị và tuyến đường.</span></span>
                </label>
                <label aria-disabled={quoteLoading || !shippingQuote?.expressEligibility?.eligible} style={{ opacity: quoteLoading || !shippingQuote?.expressEligibility?.eligible ? 0.55 : 1 }}>
                  <input type="radio" name="delivery-type" checked={deliveryType === "EXPRESS"} disabled={quoteLoading || !shippingQuote?.expressEligibility?.eligible} onChange={() => { setDeliveryType("EXPRESS"); setDate(ymd()); }} />
                  <span><b>Giao hỏa tốc</b><br /><span className="small muted">{expressDescription}</span></span>
                </label>
              </div>
              {shippingQuote?.expressEligibility?.eligible === false && <p className="tiny muted">{shippingQuote.expressEligibility.reasons?.join(" ")}</p>}
              {!hasQuoteCoordinates ? <p className="tiny muted">Chọn hoặc ghim vị trí giao hàng để tính cước theo tuyến đường.</p> : null}
              {shippingQuote?.quoteAvailable === false && <div className="notice warn">{shippingQuote.reasons?.join(" ") || "Chưa thể báo giá chính xác."}</div>}
            </div>
          </section>

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
              {addresses.length === 0 ? (
                <div className="notice" style={{ marginBottom: 4 }}>
                  Bạn chưa có địa chỉ nhận hàng lưu sẵn. Vui lòng nhập địa chỉ bên dưới, hệ thống sẽ tự động lưu lại làm địa chỉ mặc định cho các đơn hàng sau.
                </div>
              ) : (
                <div className="choice" style={{ display: "grid", gap: 10 }}>
                  {addresses.map((a) => (
                    <label
                      key={a.id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "12px 14px",
                        border: addrId === a.id ? "2px solid var(--road, #0052cc)" : "1px solid var(--line-soft, #e2e8f0)",
                        borderRadius: "var(--r-sm, 6px)",
                        background: addrId === a.id ? "rgba(0, 82, 204, 0.04)" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="addr"
                        checked={addrId === a.id}
                        onChange={() => setAddrId(a.id)}
                        style={{ marginTop: 3 }}
                      />
                      <div className="grow stack-xs">
                        <div className="row between" style={{ alignItems: "center" }}>
                          <div className="row" style={{ alignItems: "center", gap: 8 }}>
                            <b>{a.label || "Địa chỉ"}</b>
                            {a.isDefault && (
                              <span className="badge ok plain" style={{ fontSize: 11, padding: "2px 8px" }}>
                                Mặc định
                              </span>
                            )}
                          </div>
                          {!a.isDefault && (
                            <button
                              type="button"
                              className="btn sm secondary"
                              style={{ fontSize: 11, padding: "2px 8px" }}
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                await actions.setDefaultAddress(a.id);
                              }}
                            >
                              Đặt làm mặc định
                            </button>
                          )}
                        </div>
                        {(a.recipientName || a.phone) && (
                          <div className="tiny muted">
                            {[a.recipientName, a.phone].filter(Boolean).join(" · ")}
                          </div>
                        )}
                        <div className="small">{a.address}</div>
                        {(!a.lat || !a.lng) && (
                          <div className="tiny" style={{ color: "var(--stop, #e53e3e)" }}>
                            ⚠️ Chưa ghim vị trí bản đồ — tài xế cần toạ độ để giao hàng
                          </div>
                        )}
                      </div>
                    </label>
                  ))}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 14px",
                      border: addrId === "new" ? "2px solid var(--road, #0052cc)" : "1px solid var(--line-soft, #e2e8f0)",
                      borderRadius: "var(--r-sm, 6px)",
                      background: addrId === "new" ? "rgba(0, 82, 204, 0.04)" : "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="radio"
                      name="addr"
                      checked={addrId === "new"}
                      onChange={() => setAddrId("new")}
                    />
                    <span><b>+ Giao đến địa chỉ khác / Thêm địa chỉ mới</b></span>
                  </label>
                </div>
              )}

              {(addrId === "new" || addresses.length === 0) && (
                <div className="form-grid" style={{ marginTop: addresses.length ? 12 : 0, paddingTop: addresses.length ? 12 : 0, borderTop: addresses.length ? "1px dashed var(--line-soft)" : "none" }}>
                  <div className="field full">
                    <span>Tên gợi nhớ cho địa chỉ này</span>
                    <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                      {["Nhà riêng", "Công ty", "Nhà bố mẹ"].map((lbl) => (
                        <button
                          key={lbl}
                          type="button"
                          className={`btn sm ${addrLabel === lbl ? "" : "secondary"}`}
                          onClick={() => setAddrLabel(lbl)}
                        >
                          {lbl}
                        </button>
                      ))}
                    </div>
                    <input
                      className="input"
                      value={addrLabel}
                      onChange={(e) => setAddrLabel(e.target.value)}
                      placeholder="Ví dụ: Nhà riêng, Văn phòng công ty, Chung cư..."
                      maxLength={60}
                    />
                  </div>

                  <div className="field full" style={{ position: "relative" }}>
                    <span>Địa chỉ giao hàng</span>
                    <input
                      className="input"
                      value={newAddr.address}
                      onChange={(e) => onAddressChange(e.target.value)}
                      onBlur={onAddressBlur}
                      placeholder="Nhập số nhà, ngõ, tên đường, phường, quận..."
                    />
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
                  <Field label="Chú thích địa chỉ" hint="Ví dụ: hẻm nhỏ, tầng 2, gần cửa hàng">
                    <input className="input" maxLength={220} value={addressNote} onChange={(e) => setAddressNote(e.target.value)} placeholder="Thông tin giúp tìm địa chỉ" />
                  </Field>
                  <div className="field">
                    <span>Vị trí trên bản đồ</span>
                    <button type="button" className="btn secondary" onClick={() => setPickerOpen(true)}>
                      {newAddr.lat ? "Đã ghim · Chọn lại" : "Mở bản đồ chọn vị trí"}
                    </button>
                  </div>

                  <div className="full address-save-options" style={{ marginTop: 4 }}>
                    {addresses.length === 0 ? (
                      <label className="address-save-option small">
                        <input type="checkbox" checked={true} disabled />
                        <span><b>Tự động lưu làm địa chỉ mặc định</b> trong sổ địa chỉ cho các lần mua sau</span>
                      </label>
                    ) : (
                      <>
                        <label className="address-save-option small">
                          <input
                            type="checkbox"
                            checked={saveNewAddress}
                            onChange={(e) => setSaveNewAddress(e.target.checked)}
                          />
                          <span><b>Lưu địa chỉ này vào sổ địa chỉ</b> để dùng cho các lần đặt hàng sau</span>
                        </label>
                        {saveNewAddress && (
                          <label className="address-save-option small">
                            <input
                              type="checkbox"
                              checked={setAsDefault}
                              onChange={(e) => setSetAsDefault(e.target.checked)}
                            />
                            <span>Đặt làm địa chỉ mặc định</span>
                          </label>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head"><h3>Ngày và khung giờ nhận hàng</h3></div>
            <div className="panel-body stack">
              {deliveryType === "STANDARD" ? <div className="row" role="radiogroup" aria-label="Ngày giao">
                {days.map((d) => (
                  <button key={d} type="button" role="radio" aria-checked={date === d} className={`btn sm ${date === d ? "" : "secondary"}`} onClick={() => setDate(d)}>{d <= addDays(ymd(), 1) ? dateLabel(d) : `${new Date(d + "T00:00").toLocaleDateString("vi-VN", { weekday: "short" })} ${d.slice(8)}/${d.slice(5, 7)}`}</button>
                ))}
              </div> : <div className="notice">Hỏa tốc giao trong ngày, theo ETA hiển thị ở phương thức giao hàng.</div>}
              {deliveryType === "STANDARD" && <div className="choice" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))" }}>
                {WINDOWS.map((w) => (
                  <label key={w.id}>
                    <input type="radio" name="win" checked={win === w.id} disabled={isSelectedWindowTooEarly(w)} onChange={() => setWin(w.id)} />
                    <span><b>{w.label}</b><br /><span className="small muted">{w.start ? `${w.start} – ${w.end}` : "Tối thiểu 1 tiếng"}{w.hint ? `. ${w.hint}` : ""}</span></span>
                  </label>
                ))}
              </div>}
              {deliveryType === "STANDARD" && win === "custom" && (
                <div className="form-grid">
                  <Field label="Từ"><input type="time" className="input" min="08:00" max="18:00" value={custom.start} onChange={(e) => setCustom({ ...custom, start: e.target.value })} /></Field>
                  <Field label="Đến"><input type="time" className="input" min={etaClock && date === shippingQuote?.deliveryWindowDate ? etaClock : "09:00"} max="18:00" value={custom.end} onChange={(e) => setCustom({ ...custom, end: e.target.value })} /></Field>
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
            {shippingQuote?.quoteAvailable && <>
              <div className="row between"><span className="muted">Khoảng cách đường bộ</span><span>{shippingQuote.distanceKm} km</span></div>
              <div className="row between"><span className="muted">Thể tích kiện hàng</span><span>{shippingQuote.volumeM3} m³</span></div>
              <div className="row between"><span className="muted">Trọng lượng kiện hàng</span><span>{shippingQuote.weightKg} kg · {shippingQuote.packageCount} kiện</span></div>
              <div className="row between"><span className="muted">Thời gian lắp đặt dự kiến</span><span>{shippingQuote.estimatedInstallationMinutes > 0 ? formatDuration(shippingQuote.estimatedInstallationMinutes) : "Không cần lắp đặt"}</span></div>
              <div className="divider" />
              <div className="row between"><span className="muted">Cước theo quãng đường thực tế</span><span>{vnd(shippingQuote.shippingBreakdown.distanceFee)}</span></div>
            </>}
            <div className="row between"><b>Phí giao hàng</b><span>{quoteLoading ? "Đang tính…" : shippingQuote?.quoteAvailable ? vnd(shippingQuote.shippingBreakdown.totalFee) : "Chưa báo giá"}</span></div>
          </div>
          <div className="row between"><b>Tổng cộng</b><span className="price" style={{ fontSize: 22 }}>{vnd(subtotal + (shippingQuote?.shippingBreakdown?.totalFee || 0))}</span></div>
          {error && <div className="notice bad">{error}</div>}
          <button className="btn lg block" disabled={submitting || !paymentChoice || quoteLoading || !shippingQuote?.quoteAvailable || (deliveryType === "EXPRESS" && !shippingQuote?.expressEligibility?.eligible)} onClick={submit}>
            {submitting ? "Đang tạo đơn…" : paymentChoice === "COD" ? "Đặt hàng" : "Tạo đơn chờ chuyển khoản"}
          </button>
          <p className="tiny muted">Giao {date <= addDays(ymd(), 1) ? dateLabel(date).toLowerCase() : `ngày ${dateLabel(date)}`}. Cửa hàng sẽ xác nhận khung giờ và vị trí trong tuyến sau khi xếp lịch.</p>
        </aside>
      </div>

    </>
  );
}

export default function CheckoutPage() {
  return <Suspense fallback={<Loading />}><RequirePerm perm="order.place"><Checkout /></RequirePerm></Suspense>;
}
