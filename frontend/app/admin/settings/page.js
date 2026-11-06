"use client";

import { useEffect, useState } from "react";
import { api, loadToken } from "@/lib/api";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Loading } from "@/components/ui";

function Settings() {
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/api/admin/shipping-rates/history", { token: loadToken() })
      .then((rows) => setHistory(Array.isArray(rows) ? rows : []))
      .catch(() => {});
    api("/api/admin/settings", { token: loadToken() })
      .then((res) => {
        setData(res);
        setForm({
          shipping_fee: res.shipping?.fee ?? 150000,
          shipping_free_distance_km: res.shipping?.free_distance_km ?? 20,
          shipping_first_band_end_km: res.shipping?.first_band_end_km ?? 30,
          shipping_first_band_fee: res.shipping?.first_band_fee ?? 150000,
          shipping_distance_step_km: res.shipping?.distance_step_km ?? 10,
          shipping_distance_step_fee: res.shipping?.distance_step_fee ?? 50000,
          shipping_preparation_minutes: res.shipping?.preparation_minutes ?? 10,
          shipping_handover_minutes: res.shipping?.handover_minutes ?? 5,
          shipping_additional_delay_minutes: res.shipping?.additional_delay_minutes ?? 0,
          shipping_fallback_speed_kmh: res.shipping?.fallback_speed_kmh ?? 25,
          express_cutoff_time: res.express?.cutoff_time ?? "16:00",
          express_max_minutes: res.express?.max_minutes ?? 300,
          express_max_distance_km: res.express?.max_distance_km ?? 10,
          express_max_weight_kg: res.express?.max_weight_kg ?? "",
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
        shipping_free_distance_km: Number(form.shipping_free_distance_km),
        shipping_first_band_end_km: Number(form.shipping_first_band_end_km),
        shipping_first_band_fee: Number(form.shipping_first_band_fee),
        shipping_distance_step_km: Number(form.shipping_distance_step_km),
        shipping_distance_step_fee: Number(form.shipping_distance_step_fee),
        shipping_preparation_minutes: Number(form.shipping_preparation_minutes),
        shipping_handover_minutes: Number(form.shipping_handover_minutes),
        shipping_additional_delay_minutes: Number(form.shipping_additional_delay_minutes),
        shipping_fallback_speed_kmh: Number(form.shipping_fallback_speed_kmh),
        express_cutoff_time: form.express_cutoff_time.trim(),
        express_max_minutes: Number(form.express_max_minutes),
        express_max_distance_km: Number(form.express_max_distance_km),
        express_max_weight_kg: form.express_max_weight_kg === "" ? null : Number(form.express_max_weight_kg),
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
      api("/api/admin/shipping-rates/history", { token: loadToken() }).then((rows) => setHistory(Array.isArray(rows) ? rows : [])).catch(() => {});
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
            <h3 className="section-title">Cước theo quãng đường thực tế</h3>
            <p className="small muted">{`≤ ${form.shipping_free_distance_km} km miễn phí; trên ${form.shipping_free_distance_km}–${form.shipping_first_band_end_km} km là ${Number(form.shipping_first_band_fee || 0).toLocaleString("vi-VN")} ₫; mỗi ${form.shipping_distance_step_km} km tiếp theo cộng ${Number(form.shipping_distance_step_fee || 0).toLocaleString("vi-VN")} ₫.`}</p>
            <div className="grid-2">
              <label className="field"><span>Miễn phí đến (km)</span><input type="number" className="input" min="0" step="0.1" required value={form.shipping_free_distance_km} onChange={(e) => setForm({ ...form, shipping_free_distance_km: e.target.value })} /></label>
              <label className="field"><span>Ngưỡng kết thúc dải cước đầu (km)</span><input type="number" className="input" min="0.1" step="0.1" required value={form.shipping_first_band_end_km} onChange={(e) => setForm({ ...form, shipping_first_band_end_km: e.target.value })} /></label>
              <label className="field"><span>Cước từ sau ngưỡng miễn phí đến hết dải đầu (₫)</span><input type="number" className="input" min="0" step="1000" required value={form.shipping_first_band_fee} onChange={(e) => setForm({ ...form, shipping_first_band_fee: e.target.value })} /></label>
              <label className="field"><span>Độ dài mỗi dải tiếp theo (km)</span><input type="number" className="input" min="0.1" step="0.1" required value={form.shipping_distance_step_km} onChange={(e) => setForm({ ...form, shipping_distance_step_km: e.target.value })} /></label>
              <label className="field"><span>Phí cộng thêm mỗi dải (₫)</span><input type="number" className="input" min="0" step="1000" required value={form.shipping_distance_step_fee} onChange={(e) => setForm({ ...form, shipping_distance_step_fee: e.target.value })} /></label>
              <label className="field"><span>Tốc độ dự phòng khi API thiếu ETA (km/h)</span><input type="number" className="input" min="1" max="120" value={form.shipping_fallback_speed_kmh} onChange={(e) => setForm({ ...form, shipping_fallback_speed_kmh: e.target.value })} /></label>
              <label className="field"><span>Thời gian chuẩn bị (phút)</span><input type="number" className="input" min="0" value={form.shipping_preparation_minutes} onChange={(e) => setForm({ ...form, shipping_preparation_minutes: e.target.value })} /></label>
              <label className="field"><span>Thời gian giao nhận (phút)</span><input type="number" className="input" min="0" value={form.shipping_handover_minutes} onChange={(e) => setForm({ ...form, shipping_handover_minutes: e.target.value })} /></label>
              <label className="field"><span>Thời gian phát sinh (phút)</span><input type="number" className="input" min="0" value={form.shipping_additional_delay_minutes} onChange={(e) => setForm({ ...form, shipping_additional_delay_minutes: e.target.value })} /></label>
            </div>
            <div className="grid-2">
              <label className="field"><span>Cước dự phòng cho đơn quầy chưa có vị trí (₫)</span><input type="number" className="input" min="0" step="1000" value={form.shipping_fee} onChange={(e) => setForm({ ...form, shipping_fee: e.target.value })} /></label>
            </div>
          </section>

          <section className="panel panel-pad stack-sm">
            <h3 className="section-title">Điều kiện giao hỏa tốc</h3>
            <p className="small muted">Giới hạn kiểm tra lại bằng thời gian backend và số liệu tuyến đường, kiện hàng, tồn kho, sức chứa xe.</p>
            <div className="grid-2">
              <label className="field"><span>Ngừng nhận hỏa tốc (HH:mm, không bao gồm giờ này)</span><input type="text" className="input" pattern="^([01]\d|2[0-3]):[0-5]\d$" value={form.express_cutoff_time} onChange={(e) => setForm({ ...form, express_cutoff_time: e.target.value })} /></label>
              <label className="field"><span>Thời gian tối đa (phút)</span><input type="number" className="input" min="1" max="1440" value={form.express_max_minutes} onChange={(e) => setForm({ ...form, express_max_minutes: e.target.value })} /></label>
              <label className="field"><span>Khoảng cách tối đa (km)</span><input type="number" className="input" min="0.1" step="0.1" value={form.express_max_distance_km} onChange={(e) => setForm({ ...form, express_max_distance_km: e.target.value })} /></label>
              <label className="field"><span>Trọng lượng tối đa (kg)</span><input type="number" className="input" min="0.001" step="0.1" placeholder="Để trống nếu chưa giới hạn" value={form.express_max_weight_kg} onChange={(e) => setForm({ ...form, express_max_weight_kg: e.target.value })} /></label>
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

          <section className="panel panel-pad stack-sm">
            <h3 className="section-title">Lịch sử phiên bản bảng giá</h3>
            <p className="small muted">Mỗi lần thay đổi cước hoặc giới hạn vận chuyển sẽ lưu snapshot cấu hình và phiên bản áp dụng.</p>
            {!history.length ? <p className="small muted">Chưa có lần thay đổi bảng giá nào được ghi nhận.</p> : <div className="table-wrap"><table className="table">
              <thead><tr><th>Phiên bản</th><th>Thời điểm</th><th>Miễn phí đến (km)</th><th>Dải đầu đến (km)</th><th>Phí dải đầu</th><th>Bước tiếp (km)</th><th>Phí mỗi bước</th></tr></thead>
              <tbody>{history.map((item) => <tr key={item.id}>
                <td>v{item.version}</td>
                <td>{new Date(item.created_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</td>
                <td>{item.snapshot?.shipping?.free_distance_km ?? "—"}</td>
                <td>{item.snapshot?.shipping?.first_band_end_km ?? "—"}</td>
                <td>{Number(item.snapshot?.shipping?.first_band_fee || 0).toLocaleString("vi-VN")} ₫</td>
                <td>{item.snapshot?.shipping?.distance_step_km ?? "—"}</td>
                <td>{Number(item.snapshot?.shipping?.distance_step_fee || 0).toLocaleString("vi-VN")} ₫</td>
              </tr>)}</tbody>
            </table></div>}
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
