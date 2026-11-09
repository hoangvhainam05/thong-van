"use client";
import { useState } from "react";
import { api, loadToken } from "@/lib/api";

export default function PaymentSupport({ orderId }) {
  const [message, setMessage] = useState(''), [image, setImage] = useState(null), [busy, setBusy] = useState(false), [notice, setNotice] = useState(''), [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setNotice(''); setError('');
    if (message.trim().length < 5) return setError('Vui lòng nhập ít nhất 5 ký tự.');
    if (image && image.size > 3 * 1024 * 1024) return setError('Ảnh không được vượt quá 3 MB.');
    const body = new FormData(); body.append('message', message.trim()); if (image) body.append('image', image);
    setBusy(true);
    try { await api(`/api/orders/${orderId}/payment-support`, { method: 'POST', body, token: loadToken() }); setMessage(''); setImage(null); event.target.reset(); setNotice('Đã gửi yêu cầu đến nhân viên. Cửa hàng sẽ liên hệ để hỗ trợ.'); }
    catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <form className="panel panel-pad stack-sm" onSubmit={submit}><h3>Cần hỗ trợ thanh toán?</h3><p className="small muted">Nếu đã chuyển tiền nhưng đơn chưa cập nhật, hãy gửi thông tin cho nhân viên kiểm tra.</p><label htmlFor="payment-support-message">Lý do cần hỗ trợ</label><textarea id="payment-support-message" className="input" rows={3} maxLength={1000} required value={message} onChange={e => setMessage(e.target.value)} placeholder="Mô tả vấn đề bạn gặp phải"/><label htmlFor="payment-support-image">Ảnh giao dịch (không bắt buộc)</label><input id="payment-support-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setImage(e.target.files?.[0] || null)}/><span className="tiny muted">JPG, PNG hoặc WebP, tối đa 3 MB.</span>{error && <div className="notice bad" role="alert">{error}</div>}{notice && <div className="notice ok" role="status">{notice}</div>}<button className="btn secondary" disabled={busy}>{busy ? 'Đang gửi…' : 'Gửi yêu cầu hỗ trợ'}</button></form>;
}
