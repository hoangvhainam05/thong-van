"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { PAYMENT_METHOD, useStore } from "@/lib/store";
import { api, loadToken } from "@/lib/api";
import { addDays, dateLabel, vnd, ymd } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import LocationPicker from "@/components/LocationPicker";
import { Empty, Field, Loading, Modal } from "@/components/ui";
import { QRCodeSVG } from "qrcode.react";

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

  const [payosAvailable, setPayosAvailable] = useState(false);
  useEffect(() => { api("/api/orders/payos/available").then(data => setPayosAvailable(data.available)).catch(() => {}); }, []);
  const [addrId, setAddrId] = useState(defaultAddr?.id ?? "new");
  const [newAddr, setNewAddr] = useState({ address: "", district: "", lat: "", lng: "" });
  const [addrLabel, setAddrLabel] = useState("Nhà riêng");
  const [saveNewAddress, setSaveNewAddress] = useState(true);
  const [setAsDefault, setSetAsDefault] = useState(addresses.length === 0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [addressChoice, setAddressChoice] = useState(null);
  const [deleteAddress, setDeleteAddress] = useState(null);
  const [addressBusy, setAddressBusy] = useState(false);
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
  const [paymentModal, setPaymentModal] = useState(null);
  const [paymentSeconds, setPaymentSeconds] = useState(0);
  const requestIdRef = useRef(null);

  useEffect(() => {
    if (!paymentModal?.expiresAt) return undefined;
    const tick = () => setPaymentSeconds(Math.max(0, Math.ceil((new Date(paymentModal.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [paymentModal?.expiresAt]);

  let quoteProductIds = null;
  if (searchParams.has("items")) {
    try {
      const parsed = JSON.parse(searchParams.get("items"));
      quoteProductIds = new Set(Array.isArray(parsed) ? parsed.map(String) : []);
    } catch { quoteProductIds = new Set(); }
  }
  const isDirectPurchase = searchParams.has("buyNow");
  const directProductId = Number(searchParams.get("buyNow"));
  const directQuantityValue = Number(searchParams.get("qty"));
  const directQuantity = Number.isInteger(directQuantityValue) && directQuantityValue > 0
    ? Math.min(directQuantityValue, 20)
    : 1;
  const directProduct = (state?.products || []).find((product) => product.id === directProductId);
  const directLines = directProduct ? [{ productId: directProduct.id, qty: directQuantity, p: directProduct }] : [];
  const cartLines = (state?.cart || [])
    .map((line) => ({ ...line, p: state.products.find((product) => product.id === line.productId) }))
    .filter((line) => line.p);
  const requestedProductIds = searchParams.has("items")
    ? (() => {
        try {
          const parsed = JSON.parse(searchParams.get("items"));
          return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
        } catch {
          return new Set();
        }
      })()
    : null;
  const selectedCartLines = cartLines.filter((line) => !requestedProductIds || requestedProductIds.has(String(line.productId)));
  const lines = isDirectPurchase ? directLines : selectedCartLines;
  const quoteItems = (isDirectPurchase ? directLines : selectedCartLines)
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

  if (!paymentModal && !lines.length && isDirectPurchase) return <div className="panel"><Empty title="Sản phẩm không còn bán" action={<Link href="/products" className="btn">Chọn sản phẩm</Link>} /></div>;
  if (!paymentModal && !cartLines.length && !isDirectPurchase) return <div className="panel"><Empty title="Giỏ hàng đang trống" action={<Link href="/products" className="btn">Chọn sản phẩm</Link>} /></div>;
  if (!paymentModal && !lines.length) return <div className="panel"><Empty title="Chưa chọn sản phẩm để thanh toán" action={<Link href="/cart" className="btn">Quay lại giỏ hàng</Link>} /></div>;
  const subtotal = lines.reduce((s, l) => s + l.p.price * l.qty, 0);
  const paymentChoice = pay === "BANK" ? (payosAvailable ? "PAYOS" : "COD") : pay;
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
      ...(isDirectPurchase
        ? { orderItems: lines.map((line) => ({ productId: line.productId, qty: line.qty })) }
        : { productIds: lines.map((line) => line.productId) }),
    });
    setSubmitting(false);
    if (order) {
      requestIdRef.current = null;
      if (paymentChoice === "PAYOS") {
        try {
          const result = await api(`/api/orders/${order.serverId}/payos`, { method: "POST", token: loadToken() });
          setPaymentModal({ ...result, orderId: order.serverId, code: order.code, total: subtotal + (shippingQuote?.shippingBreakdown?.totalFee || 0), expiresAt: result.expiresAt || new Date(Date.now() + 15 * 60 * 1000).toISOString() });
        } catch (e) {
          setError(`Đơn ${order.code || "hàng"} đã được tạo, nhưng chưa tạo được mã thanh toán: ${e.message}. Bạn có thể thanh toán trong chi tiết đơn.`);
        }
      } else {
        router.push(`/account/orders/${order.serverId}?new=1`);
      }
    }
  };

  return (
    <>
      {paymentModal && <Modal title="Thông tin thanh toán" onClose={() => { setPaymentModal(null); router.push(`/account/orders/${paymentModal.orderId}?new=1`); }} footer={<><button className="btn secondary" onClick={() => { setPaymentModal(null); router.push(`/account/orders/${paymentModal.orderId}?new=1`); }}>Xem chi tiết đơn</button>{paymentModal.checkoutUrl && <a className="btn" href={paymentModal.checkoutUrl} target="_blank" rel="noreferrer">Mở PayOS</a>}</>}>
        <div className="stack" style={{ alignItems: "center", textAlign: "center" }}>
          <b>Đơn {paymentModal.code} đang chờ thanh toán · {vnd(paymentModal.total)}</b>
          {paymentModal.qrCode && <div style={{ background: "#fff", padding: 12 }}><QRCodeSVG value={paymentModal.qrCode} size={220} title="Mã QR thanh toán PayOS" /></div>}
          {paymentModal.details && <div className="stack-sm small" style={{ textAlign: "left", width: "100%" }}><div>Ngân hàng: <b>{paymentModal.details.bankCode}</b></div><div>Số tài khoản: <b>{paymentModal.details.accountNumber}</b></div>{paymentModal.accountName && <div>Chủ tài khoản: <b>{paymentModal.accountName}</b></div>}<div>Nội dung: <b>{paymentModal.details.transferContent}</b></div></div>}
          <div className={paymentSeconds ? "notice warn" : "notice bad"}>{paymentSeconds ? `Mã QR còn hiệu lực ${Math.floor(paymentSeconds / 60)}:${String(paymentSeconds % 60).padStart(2, "0")}` : "Mã QR đã hết hạn. Mở chi tiết đơn để tạo mã mới."}</div>
          <p className="small muted">Đơn chỉ được xác nhận thanh toán sau khi PayOS báo đã nhận tiền.</p>
        </div>
      </Modal>}
      {addressModalOpen && <Modal title={deleteAddress ? "Xóa địa chỉ" : "Chọn địa chỉ nhận hàng"} onClose={() => { if (!addressBusy) { setDeleteAddress(null); setAddressModalOpen(false); } }} footer={deleteAddress ? <>
        <button className="btn secondary" disabled={addressBusy} onClick={() => setDeleteAddress(null)}>Quay lại</button>
        <button className="btn danger" disabled={addressBusy} onClick={async () => {
          setAddressBusy(true);
          const removed = await actions.removeAddress(deleteAddress.id);
          if (removed) {
            await actions.loadAddresses();
            if (addressChoice === deleteAddress.id) {
              const remaining = addresses.filter((address) => address.id !== deleteAddress.id);
              setAddressChoice((remaining.find((address) => address.isDefault) || remaining[0])?.id ?? "new");
            }
            setDeleteAddress(null);
          }
          setAddressBusy(false);
        }}>{addressBusy ? "Đang xóa…" : "Xác nhận xóa"}</button>
      </> : <>
        <button className="btn secondary" disabled={addressBusy} onClick={() => setAddressModalOpen(false)}>Quay lại</button>
        <button className="btn" disabled={addressBusy || addressChoice === null} onClick={() => { setAddrId(addressChoice); setError(""); setAddressModalOpen(false); }}>Dùng địa chỉ này</button>
      </>}>
        {deleteAddress ? <p>Bạn muốn xóa địa chỉ <b>{deleteAddress.label || "Địa chỉ"}</b>: {deleteAddress.address}? Địa chỉ này sẽ bị xóa khỏi sổ địa chỉ.</p> : <div className="checkout-address-options" role="radiogroup" aria-label="Địa chỉ nhận hàng">
          {addresses.map((address) => <div className={`checkout-address-option ${addressChoice === address.id ? "selected" : ""}`} key={address.id}>
            <label className="checkout-address-select">
              <input type="radio" name="checkout-address" checked={addressChoice === address.id} disabled={addressBusy} onChange={() => setAddressChoice(address.id)} />
              <span><b>{address.label || "Địa chỉ"}</b> {address.isDefault && <span className="badge ok plain">Mặc định</span>}
                {(address.recipientName || address.phone) && <small>{[address.recipientName, address.phone].filter(Boolean).join(" · ")}</small>}
                <span>{address.address}</span>
                {(address.lat == null || address.lng == null) && <small>Chưa ghim vị trí trên bản đồ</small>}
              </span>
            </label>
            <div className="checkout-address-actions">
              {!address.isDefault && <button type="button" className="btn ghost sm" disabled={addressBusy} onClick={async () => { setAddressBusy(true); await actions.setDefaultAddress(address.id); setAddressBusy(false); }}>Đặt mặc định</button>}
              <button type="button" className="btn ghost sm checkout-address-delete" disabled={addressBusy} onClick={() => setDeleteAddress(address)}>Xóa</button>
            </div>
          </div>)}
          <label className={`checkout-address-option checkout-address-select ${addressChoice === "new" ? "selected" : ""}`}>
            <input type="radio" name="checkout-address" checked={addressChoice === "new"} disabled={addressBusy} onChange={() => setAddressChoice("new")} />
            <span><b>Giao đến địa chỉ khác</b><small>Nhập và ghim địa chỉ mới</small></span>
          </label>
        </div>}
      </Modal>}
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
              <div className="checkout-address-summary">
                <div className="grow">
                  {addrId !== "new" && quoteAddress ? <>
                    <div className="row"><b>{quoteAddress.label || "Địa chỉ"}</b>{quoteAddress.isDefault && <span className="badge ok plain">Mặc định</span>}</div>
                    {(quoteAddress.recipientName || quoteAddress.phone) && <div className="small muted">{[quoteAddress.recipientName, quoteAddress.phone].filter(Boolean).join(" · ")}</div>}
                    <div className="small">{quoteAddress.address}</div>
                    {(quoteAddress.lat == null || quoteAddress.lng == null) && <div className="tiny muted">Chưa ghim vị trí trên bản đồ</div>}
                  </> : <div className="small muted">{addresses.length ? "Nhập địa chỉ giao hàng khác bên dưới." : "Bạn chưa có địa chỉ lưu sẵn. Nhập địa chỉ bên dưới để giao hàng."}</div>}
                </div>
                {addresses.length > 0 && <button type="button" className="btn secondary sm" onClick={() => { setAddressChoice(addrId); setDeleteAddress(null); setAddressModalOpen(true); }}>Thay đổi</button>}
              </div>

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
                {Object.entries(PAYMENT_METHOD).filter(([k]) => !["EWALLET", "COUNTER_CASH"].includes(k) && k !== "BANK" && (k !== "PAYOS" || payosAvailable)).map(([k, label]) => (
                  <label key={k}>
                    <input type="radio" name="pay" checked={paymentChoice === k} onChange={() => setPay(k)} />
                    <span><b>{label}</b><br /><span className="small muted">{k === "COD" ? "Trả cho tài xế khi nhận và kiểm tra hàng" : k === "PAYOS" ? "Quét mã QR để thanh toán sau khi đặt hàng" : "Tạo đơn chờ chuyển khoản; nhân viên xác nhận sau khi đối soát"}</span></span>
                  </label>
                ))}
              </div>
              {paymentChoice === "PAYOS" && <p className="tiny muted" style={{ marginTop: 10 }}>Sau khi đặt hàng, bạn có thể thanh toán qua PayOS.</p>}
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
            {submitting ? "Đang tạo đơn…" : paymentChoice === "COD" ? "Đặt hàng" : "Thanh toán"}
          </button>
        </aside>
      </div>

    </>
  );
}

export default function CheckoutPage() {
  return <Suspense fallback={<Loading />}><RequirePerm perm="order.place"><Checkout /></RequirePerm></Suspense>;
}
