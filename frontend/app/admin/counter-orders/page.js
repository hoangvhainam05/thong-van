"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LocationPicker from "@/components/LocationPicker";
import { PageHead } from "@/components/AdminShell";
import { RequirePerm } from "@/components/Guard";
import { Field } from "@/components/ui";
import { api } from "@/lib/api";
import { addDays, vnd, ymd } from "@/lib/format";
import { useStore } from "@/lib/store";

const freshCounter = () => ({
  customerName: "",
  phone: "",
  address: "",
  deliveryDate: addDays(ymd(), 1),
  start: "08:00",
  end: "18:00",
  productId: "",
  quantity: "1",
  paymentMethod: "COUNTER_CASH",
  note: "",
});

const FIELD_ID = {
  customerName: "counter-customer-name",
  phone: "counter-phone",
  address: "counter-address",
  deliveryDate: "counter-delivery-date",
  product: "counter-product",
  quantity: "counter-quantity",
  window: "counter-window-start",
  note: "counter-note",
};

function minutes(value) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function CounterOrders() {
  const { state, actions, catalogStatus } = useStore();
  const [counter, setCounter] = useState(freshCounter);
  const [errors, setErrors] = useState({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [bankAvailable, setBankAvailable] = useState(false);
  const [saving, setSaving] = useState(false);
  const [successOrder, setSuccessOrder] = useState(null);
  const requestId = useRef(null);
  const today = ymd();
  const product = state.products.find((item) => item.id === Number(counter.productId));
  const quantity = Number(counter.quantity);
  const quantityOverStock = Boolean(product && quantity > product.stock);
  const phoneValue = counter.phone.trim().replace(/[\s()-]/g, "");

  useEffect(() => {
    let active = true;
    api("/api/orders/payment-instructions")
      .then((details) => { if (active) setBankAvailable(Boolean(details?.configured)); })
      .catch(() => { if (active) setBankAvailable(false); });
    return () => { active = false; };
  }, []);

  const update = (field, value) => {
    setCounter((current) => ({ ...current, [field]: value }));
    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      if (field === "productId") {
        delete next.product;
        delete next.quantity;
      }
      if (field === "start" || field === "end") delete next.window;
      return next;
    });
    setSuccessOrder(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (counter.customerName.trim().length < 2 || counter.customerName.trim().length > 120) {
      nextErrors.customerName = "Tên khách cần có từ 2 đến 120 ký tự.";
    }
    if (!/^0\d{9,10}$/.test(phoneValue)) {
      nextErrors.phone = "Nhập số điện thoại gồm 10–11 chữ số và bắt đầu bằng 0.";
    }
    if (counter.address.trim().length < 5 || counter.address.trim().length > 255) {
      nextErrors.address = "Địa chỉ cần có từ 5 đến 255 ký tự.";
    }
    if (!counter.deliveryDate || counter.deliveryDate < today) {
      nextErrors.deliveryDate = "Chọn ngày giao từ hôm nay trở đi.";
    }
    if (!product) {
      nextErrors.product = "Chọn một sản phẩm đang bán.";
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      nextErrors.quantity = "Số lượng phải là số nguyên từ 1 đến 20.";
    } else if (product && quantity > product.stock) {
      nextErrors.quantity = `Chỉ còn ${product.stock} sản phẩm trong kho.`;
    }
    const startMinutes = minutes(counter.start);
    const endMinutes = minutes(counter.end);
    if (!counter.start || !counter.end || startMinutes < 8 * 60 || endMinutes > 18 * 60 || endMinutes - startMinutes < 60) {
      nextErrors.window = "Khung giờ phải nằm trong 08:00–18:00 và dài ít nhất 1 tiếng.";
    }
    if (counter.note.length > 255) nextErrors.note = "Ghi chú không được vượt quá 255 ký tự.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const first = Object.keys(nextErrors)[0];
      document.getElementById(FIELD_ID[first])?.focus();
      return;
    }

    setSaving(true);
    setSuccessOrder(null);
    try {
      const order = await actions.createCounterOrder({
        customerName: counter.customerName.trim(),
        phone: phoneValue,
        address: counter.address.trim(),
        lat: counter.lat,
        lng: counter.lng,
        deliveryDate: counter.deliveryDate,
        window: { start: counter.start, end: counter.end },
        paymentMethod: counter.paymentMethod,
        note: counter.note.trim(),
        items: [{ product_id: product.id, quantity }],
        clientRequestId: requestId.current ||= crypto.randomUUID(),
      });
      if (order) {
        requestId.current = null;
        setSuccessOrder(order);
        setCounter(freshCounter());
        setErrors({});
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="counter-orders-page">
        <PageHead title="Đơn tại quầy" sub="Nhập thông tin khách và sản phẩm để tạo đơn giao hàng tại quầy." />

        {successOrder && (
          <div className="notice ok" role="status" style={{ marginBottom: 16 }}>
            Đã tạo đơn <Link className="strong" href={`/admin/orders/${successOrder.id}`}>{successOrder.code}</Link>.
          </div>
        )}
        {catalogStatus === "error" && <div className="notice bad" role="alert" style={{ marginBottom: 16 }}>Không tải được danh sách sản phẩm. Tải lại trang trước khi tạo đơn.</div>}

        <form className="panel panel-pad" onSubmit={submit} noValidate>
          {Object.keys(errors).length > 0 && (
            <div className="notice bad" role="alert" style={{ marginBottom: 18 }}>
              {Object.values(errors)[0]} Vui lòng sửa trường được đánh dấu bên dưới.
            </div>
          )}

          <div className="form-grid">
            <Field label="Tên khách">
              <input id={FIELD_ID.customerName} className="input" autoComplete="name" maxLength={120} value={counter.customerName} onChange={(event) => update("customerName", event.target.value)} aria-invalid={Boolean(errors.customerName)} aria-describedby={errors.customerName ? "counter-customer-name-error" : undefined} />
              {errors.customerName && <small id="counter-customer-name-error" style={{ color: "var(--stop)" }}>{errors.customerName}</small>}
            </Field>
            <Field label="Số điện thoại" hint="10–11 chữ số, bắt đầu bằng 0.">
              <input id={FIELD_ID.phone} className="input" type="tel" inputMode="tel" autoComplete="tel" maxLength={20} value={counter.phone} onChange={(event) => update("phone", event.target.value)} aria-invalid={Boolean(errors.phone)} aria-describedby={errors.phone ? "counter-phone-error" : undefined} />
              {errors.phone && <small id="counter-phone-error" style={{ color: "var(--stop)" }}>{errors.phone}</small>}
            </Field>
            <Field label="Địa chỉ giao" full>
              <input id={FIELD_ID.address} className="input" autoComplete="street-address" maxLength={255} value={counter.address} onChange={(event) => update("address", event.target.value)} aria-invalid={Boolean(errors.address)} aria-describedby={errors.address ? "counter-address-error" : undefined} />
              {errors.address && <small id="counter-address-error" style={{ color: "var(--stop)" }}>{errors.address}</small>}
            </Field>
            <div className="full">
              <button type="button" className="btn secondary" onClick={() => setPickerOpen(true)}>{counter.lat != null ? "Đã ghim vị trí · Chọn lại" : "Chọn vị trí trên bản đồ (không bắt buộc)"}</button>
            </div>

            <Field label="Sản phẩm">
              <select id={FIELD_ID.product} className="input" value={counter.productId} onChange={(event) => update("productId", event.target.value)} aria-invalid={Boolean(errors.product)} aria-describedby={errors.product ? "counter-product-error" : undefined}>
                <option value="">Chọn sản phẩm</option>
                {state.products.filter((item) => item.active).map((item) => <option key={item.id} value={item.id} disabled={item.stock < 1}>{item.name} · còn {item.stock}</option>)}
              </select>
              {errors.product && <small id="counter-product-error" style={{ color: "var(--stop)" }}>{errors.product}</small>}
            </Field>
            <Field label="Số lượng" hint={product ? `Tồn hiện tại: ${product.stock} · Tối đa ${Math.min(product.stock, 20)} chiếc.` : "Chọn sản phẩm để xem tồn kho."}>
              <input id={FIELD_ID.quantity} className="input" type="number" min="1" max={product ? Math.min(product.stock, 20) : 20} step="1" value={counter.quantity} onChange={(event) => update("quantity", event.target.value)} aria-invalid={Boolean(errors.quantity || quantityOverStock)} aria-describedby={errors.quantity || (quantityOverStock && Number.isInteger(quantity)) ? "counter-quantity-error" : undefined} />
              {(errors.quantity || (quantityOverStock && Number.isInteger(quantity))) && <small id="counter-quantity-error" style={{ color: "var(--stop)" }}>{errors.quantity || `Chỉ còn ${product.stock} sản phẩm trong kho.`}</small>}
            </Field>
            <Field label="Ngày giao">
              <input id={FIELD_ID.deliveryDate} className="input" type="date" min={today} value={counter.deliveryDate} onChange={(event) => update("deliveryDate", event.target.value)} aria-invalid={Boolean(errors.deliveryDate)} aria-describedby={errors.deliveryDate ? "counter-delivery-date-error" : undefined} />
              {errors.deliveryDate && <small id="counter-delivery-date-error" style={{ color: "var(--stop)" }}>{errors.deliveryDate}</small>}
            </Field>
            <div className="field">
              <span>Khung giờ giao</span>
              <div className="row" style={{ flexWrap: "nowrap" }}>
                <input id={FIELD_ID.window} className="input" type="time" aria-label="Giờ bắt đầu" value={counter.start} onChange={(event) => update("start", event.target.value)} aria-invalid={Boolean(errors.window)} aria-describedby={errors.window ? "counter-window-error" : undefined} />
                <span aria-hidden="true">đến</span>
                <input className="input" type="time" aria-label="Giờ kết thúc" value={counter.end} onChange={(event) => update("end", event.target.value)} aria-invalid={Boolean(errors.window)} aria-describedby={errors.window ? "counter-window-error" : undefined} />
              </div>
              {errors.window && <small id="counter-window-error" style={{ color: "var(--stop)" }}>{errors.window}</small>}
            </div>

            <Field label="Thanh toán">
              <select className="input" value={counter.paymentMethod} onChange={(event) => update("paymentMethod", event.target.value)}>
                <option value="COUNTER_CASH">Tiền mặt tại quầy</option>
                <option value="COD">Tiền mặt khi nhận</option>
                {bankAvailable && <option value="BANK">Chuyển khoản</option>}
              </select>
            </Field>
            <Field label="Ghi chú" full>
              <input id={FIELD_ID.note} className="input" maxLength={255} value={counter.note} onChange={(event) => update("note", event.target.value)} aria-invalid={Boolean(errors.note)} aria-describedby={errors.note ? "counter-note-error" : undefined} />
              {errors.note && <small id="counter-note-error" style={{ color: "var(--stop)" }}>{errors.note}</small>}
            </Field>
          </div>

          <p className="small muted" style={{ marginTop: 18 }}>
            Đơn tại quầy vẫn kiểm tra tồn kho. Đơn tiền mặt tại quầy được ghi nhận là đã thanh toán.
            {product && <span> Tạm tính sản phẩm: <b>{vnd(product.price * Math.max(0, quantity || 0))}</b>.</span>}
          </p>
          <div className="row end" style={{ marginTop: 20, borderTop: "1px solid var(--line-soft)", paddingTop: 16 }}>
            <button className="btn" type="submit" disabled={saving || catalogStatus === "loading" || catalogStatus === "error" || !state.products.some((item) => item.active && item.stock > 0)}>
              {saving ? "Đang tạo đơn…" : "Tạo đơn tại quầy"}
            </button>
          </div>
        </form>
      </div>

      {pickerOpen && <LocationPicker initial={counter} onClose={() => setPickerOpen(false)} onSelect={(location) => { setCounter((current) => ({ ...current, ...location, address: location.address || current.address })); setPickerOpen(false); setSuccessOrder(null); }} />}
    </>
  );
}

export default function CounterOrdersPage() {
  return <RequirePerm perm="order.create_counter"><CounterOrders /></RequirePerm>;
}
