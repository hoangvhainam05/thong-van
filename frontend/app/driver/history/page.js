"use client";
import { useEffect, useState } from 'react';
import { api, loadToken } from '@/lib/api';
import { dateLabel, ymd } from '@/lib/format';
import { Empty, Loading, RouteBadge } from '@/components/ui';
export default function DriverHistory() {
  const [routes,setRoutes]=useState([]), [loading,setLoading]=useState(true), [error,setError]=useState(''), [expanded,setExpanded]=useState(null), [proof,setProof]=useState(null);
  useEffect(()=>{ api('/api/driver/routes',{token:loadToken()}).then(setRoutes).catch(e=>setError(e.message)).finally(()=>setLoading(false)); },[]);
  if(loading) return <Loading/>;
  const history=routes.filter(r=>r.status==='DONE' || r.route_date<ymd());
  async function showProof(id) { try { const result=await api(`/api/driver/stops/${id}/proof`,{token:loadToken()}); setProof(result.url); } catch(e) { setError(e.message); } }
  return <div className="stack"><h1>Lịch sử giao hàng</h1>{error && <div className="notice bad">{error}</div>}{!history.length ? <div className="panel"><Empty title="Chưa có lịch sử giao hàng"/></div> : <div className="panel">{history.map(r=><div key={r.id} style={{padding:'12px 16px',borderBottom:'1px solid var(--line-soft)'}}><div className="row between"><div><b>{dateLabel(r.route_date)}</b><div className="small muted">{r.code} · {r.total_km} km</div></div><div className="right"><RouteBadge status={r.status}/><div className="tiny muted">{r.stops.filter(s=>s.result==='DELIVERED').length}/{r.stops.length} điểm thành công</div></div><button className="btn secondary sm" onClick={()=>{setExpanded(expanded===r.id?null:r.id);setProof(null);}}>Chi tiết</button></div>{expanded===r.id && <div className="stack-sm">{r.stops.map(s=><div key={s.stop_id} className="small"><b>{s.sequence}. {s.customer_name}</b> · {s.result==='DELIVERED'?'Đã giao':s.result==='FAILED'?`Không giao được: ${s.result_note}`:'Chưa hoàn tất'} {s.has_proof && <button className="btn ghost sm" onClick={()=>showProof(s.stop_id)}>Xem ảnh bằng chứng</button>}</div>)}{proof && <a href={proof} target="_blank" rel="noreferrer">Mở ảnh bằng chứng (liên kết hết hạn sau 5 phút)</a>}</div>}</div>)}</div>}</div>;
}
