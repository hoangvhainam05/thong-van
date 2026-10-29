"use client";
import { useEffect, useState } from "react";
import { api, loadToken, hhmm } from "@/lib/api";
import { useStore } from "@/lib/store";
import { vnd, ymd } from "@/lib/format";
import { Empty, Loading, Modal, RouteBadge } from "@/components/ui";

const FAIL = ["Khách không có nhà", "Không liên lạc được khách", "Khách hẹn giao lại ngày khác", "Sai địa chỉ", "Không đủ chỗ lắp đặt", "Hàng lỗi, khách từ chối nhận"];
export default function DriverToday() {
  const { can } = useStore();
  const [routes, setRoutes] = useState([]), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [fail, setFail] = useState(null), [photo, setPhoto] = useState(null), [cash, setCash] = useState(false);
  const token = loadToken();
  async function refresh() { try { setRoutes(await api('/api/driver/routes?route_date=' + ymd(), {token})); setError(''); } catch(e) { setError(e.message); } finally { setLoading(false); } }
  useEffect(() => { refresh(); }, []);
  async function run(path, body) { setBusy(true); setError(''); try { await api(path,{method:'POST',token,body}); await refresh(); return true; } catch(e) { setError(e.message); return false; } finally { setBusy(false); } }
  async function upload(stop) { if (!photo) return; const form = new FormData(); form.append('file',photo); if (await run(`/api/driver/stops/${stop.stop_id}/proof`,form)) setPhoto(null); }
  if (loading) return <Loading />;
  if (!routes.length) return <div className="stack">{error && <div className="notice bad">{error}</div>}<div className="panel"><Empty title="Hôm nay bạn chưa có tuyến">Tuyến sẽ hiện ở đây sau khi quản lý phân công và chốt.</Empty></div></div>;
  return <div className="stack">{error && <div className="notice bad">{error}</div>}{routes.map(route => {
    const done=route.stops.filter(s=>s.completed_at).length;
    const next=route.stops.find(s=>!s.completed_at);
    const cod=next?.payment_method==='COD' && next?.payment_status!=='PAID' ? next.total : 0;
    return <div className="stack" key={route.id}>
      <section className="panel panel-pad stack-sm"><div className="row between"><div><b>Tuyến {route.code}</b><div className="small muted">{route.vehicle} · {route.stops.length} điểm · {route.total_km} km</div></div><RouteBadge status={route.status}/></div><div className="progress"><span style={{width:`${route.stops.length ? done/route.stops.length*100 : 0}%`}}/></div><div className="small">Đã xử lý {done}/{route.stops.length} điểm</div></section>
      {route.status==='LOCKED' && <button className="btn lg block" disabled={busy || !can('delivery.update')} onClick={()=>run(`/api/driver/routes/${route.id}/start`)}>Bắt đầu tuyến</button>}
      {route.status==='DONE' && <div className="notice ok">Đã hoàn tất tuyến. Bàn giao tiền thu hộ khi về kho.</div>}
      {route.status==='IN_PROGRESS' && next && <section className="next-stop"><div className="ns-head"><span>Điểm tiếp theo: số {next.sequence}</span><span>Kế hoạch {hhmm(next.planned_arrival)}</span></div><div className="ns-body stack-sm">
        <div className="addr">{next.address}</div><div className="small muted">Khách hẹn {next.time_window}</div><div className="row between"><div><b>{next.customer_name}</b><div className="small muted">{next.phone}</div></div><a className="btn secondary" href={`tel:${next.phone}`}>Gọi khách</a></div>
        <div className="small stack-sm" style={{background:'var(--ground)',padding:12,borderRadius:8}}>{next.items.map((item,i)=><div key={i}>{item.quantity} × {item.name}{item.install_minutes ? ` · lắp ${item.install_minutes*item.quantity} phút` : ''}</div>)}{next.note && <div>Ghi chú: {next.note}</div>}<b>{cod ? `Thu COD ${vnd(cod)}` : 'Không thu COD'}</b></div>
        {next.lat != null && next.lng != null && <a className="btn secondary block" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${next.lat},${next.lng}`}>Chỉ đường bằng Google Maps</a>}
        {!next.actual_arrival ? <button className="btn lg block signal" disabled={busy || !can('delivery.update')} onClick={()=>run(`/api/driver/stops/${next.stop_id}/arrive`)}>Tôi đã đến nơi</button> : <>
          <div className="stack-sm"><label className="small">Ảnh bằng chứng (JPEG, PNG hoặc WebP, tối đa 5 MB)</label>{next.has_proof ? <div className="notice ok">Đã lưu ảnh bằng chứng.</div> : <><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e=>setPhoto(e.target.files?.[0] || null)}/><button className="btn secondary" disabled={!photo || busy || !can('delivery.update')} onClick={()=>upload(next)}>Tải ảnh</button></>}</div>
          {cod > 0 && <label className="row small"><input type="checkbox" checked={cash} onChange={e=>setCash(e.target.checked)}/> Đã thu đủ {vnd(cod)}</label>}
          <div className="big-actions"><button className="btn danger" disabled={busy || !can('delivery.update')} onClick={()=>setFail({stop:next,reason:FAIL[0]})}>Không giao được</button><button className="btn go" disabled={busy || !can('delivery.update') || (cod>0 && !cash)} onClick={async()=>{ if (await run(`/api/driver/stops/${next.stop_id}/complete`,{success:true,cod_collected:cod})) {setCash(false);setPhoto(null);} }}>Giao thành công</button></div>
        </>}
      </div></section>}
      <section className="panel"><div className="panel-head"><h3>Thứ tự giao</h3></div>{route.stops.map(s=><div key={s.stop_id} className="d-stop" style={{opacity:s.completed_at ? 0.65 : 1}}><span className={`seq ${s.completed_at?'done':next?.stop_id===s.stop_id?'here':''}`}>{s.completed_at?'✓':s.sequence}</span><div className="small"><div className="row between"><b>{s.customer_name}</b><span>{hhmm(s.actual_arrival || s.planned_arrival)}</span></div><div className="muted">{s.address}</div><div className="tiny muted">{s.time_window}{s.result==='FAILED' ? ` · Thất bại: ${s.result_note}` : s.result==='DELIVERED' ? ' · Đã giao' : ''}</div></div></div>)}</section>
    </div>;
  })}{fail && <Modal title="Không giao được" onClose={()=>setFail(null)} footer={<><button className="btn secondary" onClick={()=>setFail(null)}>Quay lại</button><button className="btn danger" disabled={busy} onClick={async()=>{if(await run(`/api/driver/stops/${fail.stop.stop_id}/complete`,{success:false,note:fail.reason,cod_collected:0})){setFail(null);setCash(false);setPhoto(null);}}}>Xác nhận</button></>}><div className="choice">{FAIL.map(r=><label key={r}><input type="radio" name="fail" checked={fail.reason===r} onChange={()=>setFail({...fail,reason:r})}/>{r}</label>)}</div></Modal>}</div>;
}
