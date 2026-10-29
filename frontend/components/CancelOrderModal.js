"use client";

import { useState } from "react";
import { Modal } from "@/components/ui";
import { useStore } from "@/lib/store";

const reasons = ["Khách đổi ý", "Hết hàng", "Không liên lạc được khách", "Khách đặt trùng đơn", "Lý do khác"];
export default function CancelOrderModal({ order, onClose }) {
  const { actions } = useStore();
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const value = reason === "Lý do khác" ? other.trim() : reason;
  async function submit() {
    if (!value || busy) return;
    setBusy(true);
    const ok = await actions.cancelOrder(order.id, value);
    setBusy(false);
    if (ok) onClose();
  }
  return <Modal title={`Huỷ đơn ${order.code}`} onClose={() => { if (!busy) onClose(); }} footer={<><button className="btn secondary" disabled={busy} onClick={onClose}>Giữ đơn</button><button className="btn danger" disabled={!value || busy} onClick={submit}>{busy ? "Đang huỷ…" : "Xác nhận huỷ đơn"}</button></>}>
    <p className="small" style={{ marginBottom: 12 }}>Chọn lý do huỷ đơn:</p>
    <div className="choice">{reasons.map(item => <label key={item}><input type="radio" name="cancel-reason" checked={reason === item} onChange={() => setReason(item)} />{item}</label>)}</div>
    {reason === "Lý do khác" && <label className="field" style={{ marginTop: 12 }}><span>Lý do cụ thể</span><textarea className="input" rows={3} maxLength={255} value={other} onChange={e => setOther(e.target.value)} /></label>}
    {order.status === "SCHEDULED" && <div className="notice warn" style={{ marginTop: 12 }}>Tuyến chứa đơn này sẽ được mở lại. Các đơn còn lại chuyển về sẵn sàng giao và cần xếp tuyến lại.</div>}
    {order.payment.status === "PAID" && <div className="notice warn" style={{ marginTop: 12 }}>Đơn đã thanh toán. Nhân viên cần xử lý hoàn tiền riêng; thao tác huỷ không tự hoàn tiền.</div>}
    <p className="small muted" style={{ marginTop: 12 }}>Lý do được lưu trong lịch sử và thông báo của khách hàng.</p>
  </Modal>;
}
