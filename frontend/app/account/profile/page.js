"use client";

import { useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { api } from "@/lib/api";
import { Field } from "@/components/ui";
import LocationPicker from "@/components/LocationPicker";

export default function Profile() {
  const { user, state, actions } = useStore();
  const [info, setInfo] = useState({ name: user.name, email: user.email || "" });
  const [pw, setPw] = useState({ old: "", next: "" });

  const customer = state?.customers?.find((c) => c.id === user?.customerId || c.authUserId === user?.id) || state?.customers?.[0];
  const addresses = customer?.addresses || [];

  const [editingAddr, setEditingAddr] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrError, setAddrError] = useState("");
  const searchTimeoutRef = useRef(null);

  const openNewAddress = () => {
    setAddrError("");
    setEditingAddr({
      label: "Nhà riêng",
      recipientName: user.name || "",
      phone: user.phone || "",
      address: "",
      district: "",
      lat: null,
      lng: null,
      isDefault: addresses.length === 0,
    });
  };

  const openEditAddress = (addr) => {
    setAddrError("");
    setEditingAddr({
      id: addr.id,
      label: addr.label || "Nhà riêng",
      recipientName: addr.recipientName || user.name || "",
      phone: addr.phone || user.phone || "",
      address: addr.address || "",
      district: addr.district || "",
      lat: addr.lat,
      lng: addr.lng,
      isDefault: Boolean(addr.isDefault),
    });
  };

  const onAddressChange = (val) => {
    if (!editingAddr) return;
    if (!val || !val.trim()) {
      setEditingAddr((prev) => ({ ...prev, address: "", district: "", lat: null, lng: null }));
      setSuggestions([]);
      return;
    }
    setEditingAddr((prev) => ({ ...prev, address: val }));
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
    if (!editingAddr) return;
    setEditingAddr((prev) => ({
      ...prev,
      address: item.display_name || "",
      district: item.address?.city_district || item.address?.district || item.address?.county || "",
      lat: Number(item.lat),
      lng: Number(item.lon),
    }));
    setSuggestions([]);
    setPickerOpen(true);
  };

  const saveAddressForm = async (e) => {
    e.preventDefault();
    if (savingAddr || !editingAddr) return;
    setAddrError("");
    if (!editingAddr.address || editingAddr.address.trim().length < 5) {
      setAddrError("Vui lòng nhập địa chỉ hợp lệ.");
      return;
    }
    if (!editingAddr.lat || !editingAddr.lng) {
      setPickerOpen(true);
      setAddrError("Vui lòng ghim vị trí trên bản đồ để lưu toạ độ giao hàng chính xác.");
      return;
    }
    setSavingAddr(true);
    const ok = await actions.saveAddress(editingAddr);
    setSavingAddr(false);
    if (ok) {
      setEditingAddr(null);
    }
  };

  return (
    <>
      {pickerOpen && editingAddr && (
        <LocationPicker
          initial={editingAddr}
          onClose={() => setPickerOpen(false)}
          onSelect={(location) => {
            setEditingAddr((prev) => ({
              ...prev,
              ...location,
              address: location.address || prev.address || "",
              district: location.district || prev.district || "",
            }));
            setPickerOpen(false);
            setAddrError("");
          }}
        />
      )}

      <div className="stack">
        <h1>Tài khoản</h1>

        <section className="panel">
          <div className="panel-head"><h3>Thông tin cá nhân</h3></div>
          <form className="panel-body form-grid" onSubmit={(e) => { e.preventDefault(); actions.updateProfile(info); }}>
            <Field label="Họ tên"><input className="input" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} required /></Field>
            <Field label="Số điện thoại" hint="Dùng để đăng nhập và tra cứu đơn, liên hệ cửa hàng để đổi"><input className="input" value={user.phone || ""} disabled /></Field>
            <Field label="Email"><input className="input" type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} /></Field>
            <div className="row end full"><button className="btn">Lưu thông tin</button></div>
          </form>
        </section>

        {/* Sổ địa chỉ */}
        <section className="panel">
          <div className="panel-head row between" style={{ alignItems: "center" }}>
            <h3>Sổ địa chỉ nhận hàng</h3>
            {!editingAddr && (
              <button type="button" className="btn sm" onClick={openNewAddress}>
                + Thêm địa chỉ mới
              </button>
            )}
          </div>
          <div className="panel-body stack">
            {editingAddr ? (
              <form onSubmit={saveAddressForm} className="form-grid" style={{ background: "var(--line-soft, #f8fafc)", padding: 16, borderRadius: "var(--r-sm, 6px)" }}>
                <h4 className="full" style={{ margin: 0 }}>
                  {editingAddr.id ? "Chỉnh sửa địa chỉ" : "Thêm địa chỉ nhận hàng mới"}
                </h4>

                <div className="field full">
                  <span>Tên gợi nhớ</span>
                  <div className="row" style={{ gap: 8, marginBottom: 6 }}>
                    {["Nhà riêng", "Công ty", "Nhà bố mẹ"].map((lbl) => (
                      <button
                        key={lbl}
                        type="button"
                        className={`btn sm ${editingAddr.label === lbl ? "" : "secondary"}`}
                        onClick={() => setEditingAddr({ ...editingAddr, label: lbl })}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <input
                    className="input"
                    value={editingAddr.label || ""}
                    onChange={(e) => setEditingAddr({ ...editingAddr, label: e.target.value })}
                    placeholder="Ví dụ: Nhà riêng, Công ty, Kho xưởng..."
                    required
                  />
                </div>

                <Field label="Họ tên người nhận">
                  <input
                    className="input"
                    value={editingAddr.recipientName || ""}
                    onChange={(e) => setEditingAddr({ ...editingAddr, recipientName: e.target.value })}
                    placeholder="Tên người nhận hàng tại địa chỉ này"
                  />
                </Field>

                <Field label="Số điện thoại nhận hàng">
                  <input
                    className="input"
                    inputMode="tel"
                    value={editingAddr.phone || ""}
                    onChange={(e) => setEditingAddr({ ...editingAddr, phone: e.target.value })}
                    placeholder="Số điện thoại nhận hàng"
                  />
                </Field>

                <div className="field full" style={{ position: "relative" }}>
                  <span>Địa chỉ chi tiết</span>
                  <input
                    className="input"
                    value={editingAddr.address || ""}
                    onChange={(e) => onAddressChange(e.target.value)}
                    onBlur={() => setTimeout(() => setSuggestions([]), 250)}
                    placeholder="Số nhà, ngõ ngách, tên đường, phường/xã, quận/huyện..."
                    required
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

                <div className="field">
                  <span>Toạ độ trên bản đồ</span>
                  <button type="button" className="btn secondary" onClick={() => setPickerOpen(true)}>
                    {editingAddr.lat ? "Đã ghim vị trí · Sửa lại" : "Mở bản đồ chọn vị trí"}
                  </button>
                </div>

                <div className="field full">
                  <label className="row small" style={{ cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={editingAddr.isDefault}
                      onChange={(e) => setEditingAddr({ ...editingAddr, isDefault: e.target.checked })}
                    />
                    <span>Đặt làm địa chỉ nhận hàng mặc định</span>
                  </label>
                </div>

                {addrError && <div className="notice bad full">{addrError}</div>}

                <div className="row end full" style={{ gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn secondary"
                    disabled={savingAddr}
                    onClick={() => { setEditingAddr(null); setAddrError(""); }}
                  >
                    Huỷ
                  </button>
                  <button className="btn" disabled={savingAddr}>
                    {savingAddr ? "Đang lưu…" : "Lưu địa chỉ"}
                  </button>
                </div>
              </form>
            ) : null}

            {addresses.length === 0 ? (
              <div className="muted small" style={{ textAlign: "center", padding: "16px 0" }}>
                Chưa có địa chỉ nào được lưu. Bạn có thể thêm địa chỉ ở đây hoặc lưu tự động khi đặt hàng.
              </div>
            ) : (
              <div className="stack-sm">
                {addresses.map((a) => (
                  <div
                    key={a.id}
                    style={{
                      border: "1px solid var(--line-soft, #e2e8f0)",
                      borderRadius: "var(--r-sm, 6px)",
                      padding: "14px 16px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: 12,
                    }}
                  >
                    <div className="grow stack-xs">
                      <div className="row" style={{ alignItems: "center", gap: 8 }}>
                        <b>{a.label || "Địa chỉ"}</b>
                        {a.isDefault && (
                          <span className="badge ok plain" style={{ fontSize: 11, padding: "2px 8px" }}>
                            Mặc định
                          </span>
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
                          ⚠️ Chưa có toạ độ ghim bản đồ
                        </div>
                      )}
                    </div>

                    <div className="row" style={{ gap: 6, flexShrink: 0 }}>
                      {!a.isDefault && (
                        <button
                          type="button"
                          className="btn sm secondary"
                          style={{ fontSize: 11, padding: "4px 8px" }}
                          onClick={() => actions.setDefaultAddress(a.id)}
                        >
                          Đặt mặc định
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn sm secondary"
                        style={{ fontSize: 11, padding: "4px 8px" }}
                        onClick={() => openEditAddress(a)}
                      >
                        Sửa
                      </button>
                      <button
                        type="button"
                        className="btn sm secondary"
                        style={{ fontSize: 11, padding: "4px 8px", color: "var(--stop, #e53e3e)" }}
                        onClick={() => {
                          if (confirm(`Bạn có chắc muốn xoá địa chỉ "${a.label || a.address}"?`)) {
                            actions.removeAddress(a.id);
                          }
                        }}
                      >
                        Xoá
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-head"><h3>Đổi mật khẩu</h3></div>
          <form className="panel-body form-grid" onSubmit={(e) => { e.preventDefault(); if (pw.next.length < 8) return; actions.changePassword(pw.old, pw.next).then((ok) => { if (ok) setPw({ old: "", next: "" }); }); }}>
            <Field label="Mật khẩu hiện tại"><input className="input" type="password" value={pw.old} onChange={(e) => setPw({ ...pw, old: e.target.value })} required /></Field>
            <Field label="Mật khẩu mới" hint="Ít nhất 8 ký tự"><input className="input" type="password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required /></Field>
            <div className="row end full"><button className="btn secondary">Đổi mật khẩu</button></div>
          </form>
        </section>
      </div>
    </>
  );
}
