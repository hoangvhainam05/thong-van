"use client";

import { useEffect, useState } from "react";
import { api, loadToken } from "@/lib/api";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Loading } from "@/components/ui";

function Settings() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/admin/settings", { token: loadToken() })
      .then((res) => {
        setData(res);
        setForm({
          shipping_fee: res.shipping?.fee ?? 150000,
          free_ship_from: res.shipping?.free_from ?? 5000000,
          delivery_day_start: res.optimization?.day_start ?? "08:00",
          delivery_day_end: res.optimization?.day_end ?? "18:00",
          avg_speed_kmh: res.optimization?.speed_kmh ?? 30,
          road_factor: res.optimization?.road_factor ?? 1.35,
          weight_km: res.optimization?.weight_km ?? 1.0,
          weight_time: res.optimization?.weight_time ?? 0.5,
          bank_name: res.payment?.bank_name ?? "",
          bank_account_name: res.payment?.bank_account_name ?? "",
          bank_account_number: res.payment?.bank_account_number ?? "",
          bank_transfer_prefix: res.payment?.bank_transfer_prefix ?? "THONGVAN",
          warranty_contact: res.warranty?.contact ?? "",
        });
      })
      .catch((e) => setError(e.message));
  }, []);

  async function save(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const payload = {
        shipping_fee: Number(form.shipping_fee),
        free_ship_from: Number(form.free_ship_from),
        delivery_day_start: form.delivery_day_start.trim(),
        delivery_day_end: form.delivery_day_end.trim(),
        avg_speed_kmh: Number(form.avg_speed_kmh),
        road_factor: Number(form.road_factor),
        weight_km: Number(form.weight_km),
        weight_time: Number(form.weight_time),
        bank_name: form.bank_name.trim(),
        bank_account_name: form.bank_account_name.trim(),
        bank_account_number: form.bank_account_number.trim(),
        bank_transfer_prefix: form.bank_transfer_prefix.trim() || "THONGVAN",
        warranty_contact: form.warranty_contact.trim(),
      };
      const updated = await api("/api/admin/settings", {
        method: "PATCH",
        token: loadToken(),
        body: payload,
      });
      setData(updated);
      setMessage("Đã lưu toàn bộ cấu hình hệ thống vào cơ sở dữ liệu.");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead
        title="Cài đặt hệ thống"
        sub="Quản lý chính sách phí giao hàng, tham số tối ưu lộ trình xe và thông tin thanh toán lưu trong cơ sở dữ liệu."
      />
      {error && <div className="notice bad" role="alert">{error}</div>}
      {message && <div className="notice ok" role="status">{message}</div>}

      {!form ? (
        !error && <Loading />
      ) : (
        <form onSubmit={save} className="stack-md">
          {/* Nhóm 1: Chính sách phí vận chuyển */}
          <section className="panel panel-pad stack-sm">
            <h3 className="section-title">Phí vận chuyển đơn hàng</h3>
            <p className="small muted">Áp dụng tự động khi khách đặt hàng trên web hoặc nhập đơn tại quầy.</p>
            <div className="grid-2">
              <label className="field">
                <span>Phí giao hàng tiêu chuẩn (₫)</span>
                <input
                  type="number"
                  className="input"
                  min="0"
                  step="1000"
                  required
                  value={form.shipping_fee}
                  onChange={(e) => setForm({ ...form, shipping_fee: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Miễn phí vận chuyển từ (₫)</span>
                <input
                  type="number"
                  className="input"
                  min="0"
                  step="10000"
                  required
                  value={form.free_ship_from}
                  onChange={(e) => setForm({ ...form, free_ship_from: e.target.value })}
                />
              </label>
            </div>
          </section>

          {/* Nhóm 2: Tham số tối ưu tuyến đường */}
          <section className="panel panel-pad stack-sm">
            <h3 className="section-title">Thuật toán tối ưu tuyến đường (Dispatch)</h3>
            <p className="small muted">Các ràng buộc thời gian và hệ số tính toán lộ trình xe giao hàng trong ngày.</p>
            <div className="grid-2">
              <label className="field">
                <span>Giờ bắt đầu ca giao (HH:mm)</span>
                <input
                  type="text"
                  className="input"
                  pattern="^([01]\d|2[0-3]):[0-5]\d$"
                  placeholder="08:00"
                  required
                  value={form.delivery_day_start}
                  onChange={(e) => setForm({ ...form, delivery_day_start: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Giờ kết thúc ca giao tối đa (HH:mm)</span>
                <input
                  type="text"
                  className="input"
                  pattern="^([01]\d|2[0-3]):[0-5]\d$"
                  placeholder="18:00"
                  required
                  value={form.delivery_day_end}
                  onChange={(e) => setForm({ ...form, delivery_day_end: e.target.value })}
                />
              </label>
            </div>
            <div className="grid-2">
              <label className="field">
                <span>Vận tốc xe trung bình trong nội thành (km/h)</span>
                <input
                  type="number"
                  className="input"
                  min="5"
                  max="100"
                  step="1"
                  required
                  value={form.avg_speed_kmh}
                  onChange={(e) => setForm({ ...form, avg_speed_kmh: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Hệ số uốn lượn đường sá thực tế (Road factor)</span>
                <input
                  type="number"
                  className="input"
                  min="1.0"
                  max="3.0"
                  step="0.05"
                  required
                  value={form.road_factor}
                  onChange={(e) => setForm({ ...form, road_factor: e.target.value })}
                />
              </label>
            </div>
            <div className="grid-2">
              <label className="field">
                <span>Trọng số ưu tiên Quãng đường (Weight Km)</span>
                <input
                  type="number"
                  className="input"
                  min="0"
                  step="0.1"
                  required
                  value={form.weight_km}
                  onChange={(e) => setForm({ ...form, weight_km: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Trọng số ưu tiên Thời gian (Weight Time)</span>
                <input
                  type="number"
                  className="input"
                  min="0"
                  step="0.1"
                  required
                  value={form.weight_time}
                  onChange={(e) => setForm({ ...form, weight_time: e.target.value })}
                />
              </label>
            </div>
          </section>

          {/* Nhóm 3: Thông tin chuyển khoản & CSKH */}
          <section className="panel panel-pad stack-sm">
            <h3 className="section-title">Tài khoản thanh toán & Chăm sóc khách hàng</h3>
            <p className="small muted">Hiển thị khi khách hàng chọn phương thức Chuyển khoản ngân hàng hoặc xem thông tin bảo hành.</p>
            <div className="grid-2">
              <label className="field">
                <span>Tên ngân hàng</span>
                <input
                  type="text"
                  className="input"
                  placeholder="Ví dụ: MB Bank, Vietcombank"
                  value={form.bank_name}
                  onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Chủ tài khoản</span>
                <input
                  type="text"
                  className="input"
                  placeholder="Ví dụ: CUA HANG THONG VAN"
                  value={form.bank_account_name}
                  onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })}
                />
              </label>
            </div>
            <div className="grid-2">
              <label className="field">
                <span>Số tài khoản ngân hàng</span>
                <input
                  type="text"
                  className="input"
                  placeholder="Ví dụ: 9999999999"
                  value={form.bank_account_number}
                  onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Cú pháp nội dung chuyển khoản</span>
                <input
                  type="text"
                  className="input"
                  placeholder="THONGVAN"
                  value={form.bank_transfer_prefix}
                  onChange={(e) => setForm({ ...form, bank_transfer_prefix: e.target.value })}
                />
              </label>
            </div>
            <label className="field">
              <span>Hotline & Liên hệ bảo hành</span>
              <input
                type="text"
                className="input"
                placeholder="Ví dụ: 0988 000 001 - CSKH Thông Vân"
                value={form.warranty_contact}
                onChange={(e) => setForm({ ...form, warranty_contact: e.target.value })}
              />
            </label>
          </section>

          <div>
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Đang lưu cấu hình…" : "Lưu thay đổi cài đặt"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}

export default function SettingsPage() {
  return (
    <RequirePerm perm="settings.manage">
      <Settings />
    </RequirePerm>
  );
}
