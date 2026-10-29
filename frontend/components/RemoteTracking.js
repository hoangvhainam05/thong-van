"use client";
import { useState } from "react";
import { api, vnd } from "@/lib/api";
import { dateLabel, dateTime } from "@/lib/format";
import { OrderBadge } from "@/components/ui";
import RouteStrip from "@/components/RouteStrip";

export default function RemoteTracking({ tracking, proofRequest }) {
  const [proof,setProof]=useState(null), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const time = value => value ? new Date(value).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'}) : '—';
  const instructions=tracking.payment_instructions;
  const strip=tracking.position == null ? [] : Array.from({length:tracking.total_stops},(_,i)=>({seq:i+1,me:i+1===tracking.position,here:i===0,done:false}));
  async function showProof() { setBusy(true); setError(''); try { const data=await api(proofRequest.path,proofRequest.options); setProof(data.url); } catch(e){setError(e.message);} finally{setBusy(false);} }
  return <div className="two-col"><div className="stack">
    <section className="panel panel-pad stack"><div className="row between"><div><div className="small muted">Đơn {tracking.code} · giao {dateLabel(tracking.delivery_date)} · khung {tracking.time_window}</div><h2 style={{fontSize:24,marginTop:6}}>{tracking.message}</h2></div><OrderBadge status={tracking.status}/></div>
      {tracking.position != null && <><div className="kpis" style={{gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))'}}><div className="kpi"><div className="label">Vị trí của bạn</div><div className="value">#{tracking.position} / {tracking.total_stops}</div></div><div className="kpi"><div className="label">Còn trước bạn</div><div className="value">{tracking.stops_before} điểm</div></div><div className="kpi"><div className="label">Dự kiến xe tới</div><div className="value" style={{fontSize:20}}>{time(tracking.eta_start)} – {time(tracking.eta_end)}</div></div></div><RouteStrip strip={strip}/>{!tracking.route_locked && <div className="notice warn">Lịch giao có thể điều chỉnh trước khi chốt tuyến.</div>}</>}
      {tracking.requested_info?.length>0 && <div className="notice warn stack-sm"><b>Cửa hàng cần bạn bổ sung thông tin</b>{tracking.requested_info.map((x,i)=><div key={i}>{x.message}</div>)}</div>}
      {tracking.proof_available && <div className="stack-sm"><button className="btn secondary" disabled={busy} onClick={showProof}>Xem ảnh bàn giao</button>{proof && <a href={proof} target="_blank" rel="noreferrer">Mở ảnh bàn giao (liên kết có hạn 5 phút)</a>}{error && <div className="notice bad">{error}</div>}</div>}
    </section>
    <section className="panel panel-pad stack-sm"><h3>Sản phẩm</h3>{tracking.items?.map((item,i)=><div key={i} className="row between small"><span>{item.name} × {item.quantity}{tracking.status==='DELIVERED' && <span className="tiny muted" style={{display:'block'}}>{item.warranty_months == null ? 'Chưa có dữ liệu thời hạn bảo hành' : item.warranty_months === 0 ? 'Không có thời hạn bảo hành' : `Bảo hành ${item.warranty_months} tháng, đến trước ${item.warranty_end_exclusive?.split('-').reverse().join('/')}`}</span>}</span><span>{vnd(item.unit_price*item.quantity)}</span></div>)}<div className="row between small"><span>Phí giao hàng</span><span>{vnd(tracking.shipping_fee)}</span></div><div className="row between"><b>Tổng cộng</b><b>{vnd(tracking.total)}</b></div></section>
    <section className="panel panel-pad"><h3 style={{marginBottom:14}}>Tiến trình đơn</h3><ul className="timeline">{tracking.timeline.map(item=><li key={item.status} className={item.state}><span className="dot"/><div className="t-title">{item.label}</div></li>)}</ul></section>
    <section className="panel panel-pad stack-sm"><h3>Lịch sử cập nhật</h3>{tracking.history?.length ? tracking.history.map(event=><div key={event.id} className="small"><b>{event.label}</b> · {dateTime(event.at)}{event.note && <div className="muted">{event.note}</div>}</div>) : <p className="small muted">Chưa có lịch sử cập nhật.</p>}</section>
  </div><aside className="stack">{tracking.status==='DELIVERED' && <section className="panel panel-pad stack-sm small"><h3>Liên hệ bảo hành</h3><div>{tracking.warranty_contact || 'Liên hệ cửa hàng để được hỗ trợ bảo hành.'}</div></section>}<section className="panel panel-pad stack-sm small"><h3>Giao tới</h3><b>{tracking.recipient_name}</b><div>{tracking.address}</div></section>
    <section className="panel panel-pad stack-sm small"><h3>Thanh toán</h3><div>{tracking.payment_method==='BANK_TRANSFER'?'Chuyển khoản':tracking.payment_method==='COUNTER_CASH'?'Tiền mặt tại quầy':'Tiền mặt khi nhận'} · {tracking.payment_status==='PAID'?'Đã thanh toán':tracking.payment_status==='PENDING'?'Chờ chuyển khoản':'Chưa thanh toán'}</div></section>
    {tracking.payment_method==='BANK_TRANSFER' && tracking.payment_status==='PENDING' && <section className="panel panel-pad stack-sm small"><h3>Hướng dẫn chuyển khoản</h3>{instructions?.configured ? <><div>Ngân hàng: <b>{instructions.bank_name}</b></div><div>Tên tài khoản: <b>{instructions.account_name}</b></div><div>Số tài khoản: <b>{instructions.account_number}</b></div><div>Số tiền: <b>{vnd(instructions.amount)}</b></div><div>Nội dung: <b>{instructions.transfer_content}</b></div></> : <div className="notice warn">Cửa hàng chưa cấu hình thông tin nhận chuyển khoản.</div>}</section>}
  </aside></div>;
}
