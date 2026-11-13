"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, loadToken } from "@/lib/api";
import { Empty, Loading, Modal } from "@/components/ui";
import { playTap, playSuccess } from "@/lib/audio-juice";
import { ShieldCheck, Wrench, Calendar, Phone, CheckCircle2 } from "lucide-react";

const labels = {
  ACTIVE: "Còn bảo hành",
  EXPIRED: "Hết thời hạn",
  NONE: "Không có bảo hành",
  UNKNOWN: "Chưa có dữ liệu thời hạn",
};

const vnDate = (value) => (value ? value.split("-").reverse().join("/") : "—");

export default function Warranties() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null);
  const [confirmation, setConfirmation] = useState(null);

  async function refresh() {
    try {
      const data = await api("/api/account/warranties", { token: loadToken() });
      setItems(data);
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function complete(item) {
    setBusy(item.item_id);
    setError("");
    try {
      await api(`/api/account/maintenance/${item.item_id}/complete`, {
        method: "POST",
        token: loadToken(),
        body: { cycle: item.maintenance.cycle },
      });
      playSuccess();
      await refresh();
      setConfirmation(null);
      window.dispatchEvent(new Event("thongvan-notifications"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  }

  if (!items && !error) return <Loading message="Đang tải dữ liệu bảo hành…" />;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 26 }}>Bảo hành & bảo dưỡng thiết bị</h1>
        <p className="small muted" style={{ marginTop: 4 }}>
          Thời hạn tính từ ngày giao hàng thành công. Quản lý hạn bảo hành chính hãng và chu kỳ bảo dưỡng định kỳ tại gia.
        </p>
      </div>

      {error && <div className="notice bad animate-pop-in">{error}</div>}

      {items && !items.length ? (
        <div className="panel">
          <Empty title="Chưa có thiết bị nào đã giao">
            Các thiết bị điện máy bạn mua sẽ tự động xuất hiện tại đây sau khi được giao thành công.
          </Empty>
        </div>
      ) : (
        <div className="stack" style={{ gap: 14 }}>
          {items?.map((item) => (
            <section
              className="panel panel-pad stack-sm"
              key={item.item_id}
              style={{ boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)" }}
            >
              <div className="row between" style={{ alignItems: "flex-start" }}>
                <div>
                  <b style={{ fontSize: 16 }}>
                    {item.product_name} × {item.quantity}
                  </b>
                  <div className="small muted" style={{ marginTop: 2 }}>
                    Đơn hàng:{" "}
                    <Link
                      href={`/account/orders/${item.order_id}`}
                      style={{ color: "var(--road)", fontWeight: 600 }}
                    >
                      {item.code}
                    </Link>{" "}
                    · Giao ngày {vnDate(item.delivered_date)}
                  </div>
                </div>
                <span className={`badge ${item.warranty_status === "ACTIVE" ? "ok" : ""}`}>
                  {labels[item.warranty_status]}
                </span>
              </div>

              <div className="small" style={{ lineHeight: 1.5, marginTop: 4 }}>
                {item.warranty_status === "UNKNOWN"
                  ? "Đơn chưa lưu thời hạn tại thời điểm mua. Vui lòng liên hệ cửa hàng để kiểm tra."
                  : item.warranty_status === "NONE"
                  ? "Sản phẩm không có thời hạn bảo hành cấu hình."
                  : `Thời hạn bảo hành ${item.warranty_months} tháng chính hãng; có hiệu lực đến trước ngày ${vnDate(
                      item.warranty_end_exclusive
                    )}.`}
              </div>

              <div className="small muted row" style={{ gap: 6, alignItems: "center" }}>
                <Phone size={13} color="var(--muted)" />
                <span>{item.contact ? `Liên hệ bảo hành: ${item.contact}` : "Liên hệ tổng đài 1900 0000 để được hỗ trợ bảo hành."}</span>
              </div>

              <div className="divider" />

              {item.maintenance ? (
                <div className="row between" style={{ alignItems: "center" }}>
                  <div className="small">
                    <b className="row" style={{ gap: 6, alignItems: "center" }}>
                      <Wrench size={14} color="var(--signal)" />
                      <span>Bảo dưỡng định kỳ mỗi {item.maintenance.interval_months} tháng</span>
                    </b>
                    <div style={{ marginTop: 2 }}>
                      Lịch bảo dưỡng tiếp theo: <b>{vnDate(item.maintenance.due_date)}</b>
                    </div>
                    {item.maintenance.last_completed && (
                      <div className="muted" style={{ fontSize: 12 }}>
                        Lần gần nhất bạn ghi nhận: {vnDate(item.maintenance.last_completed)}
                      </div>
                    )}
                  </div>
                  <button
                    className="btn secondary sm"
                    disabled={busy !== null}
                    onClick={() => {
                      playTap(700, 0.03);
                      setConfirmation(item);
                    }}
                  >
                    {busy === item.item_id ? "Đang lưu…" : "Ghi nhận đã bảo dưỡng"}
                  </button>
                </div>
              ) : (
                <div className="small muted">Thiết bị không yêu cầu chu kỳ bảo dưỡng định kỳ.</div>
              )}
            </section>
          ))}
        </div>
      )}

      {confirmation && (
        <Modal
          title="Ghi nhận bảo dưỡng thiết bị"
          onClose={() => setConfirmation(null)}
          footer={
            <>
              <button className="btn secondary" disabled={busy !== null} onClick={() => setConfirmation(null)}>
                Hủy
              </button>
              <button className="btn btn-glow" disabled={busy !== null} onClick={() => complete(confirmation)}>
                {busy !== null ? "Đang lưu…" : "Xác nhận hoàn thành"}
              </button>
            </>
          }
        >
          <div className="stack" style={{ gap: 12 }}>
            <p>
              Bạn muốn ghi nhận đã hoàn thành đợt bảo dưỡng cho thiết bị <b>{confirmation.product_name}</b>?
            </p>
            <p className="small muted">
              Đây là thông tin ghi nhớ chu kỳ bảo dưỡng định kỳ của bạn trên hệ thống, giúp bạn dễ dàng theo dõi tình trạng máy.
            </p>
            {error && <div className="notice bad animate-pop-in">{error}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
}
