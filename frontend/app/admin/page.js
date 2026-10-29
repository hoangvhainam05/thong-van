"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, loadToken } from '@/lib/api';
import { useStore } from '@/lib/store';
import { vnd, ymd } from '@/lib/format';
import { RequirePerm } from '@/components/Guard';
import { PageHead } from '@/components/AdminShell';
import { Kpi, Loading } from '@/components/ui';
function Dashboard(){
 const {user,can}=useStore(),[data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let active=true;api(`/api/admin/dashboard?date=${ymd()}`,{token:loadToken()}).then(x=>{if(active)setData(x);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[]);
 if(error)return <div className="notice bad">{error}</div>;if(!data)return <Loading/>;
 const t=data.totals, todo=data.todo;
 const actions=[can('order.confirm')&&todo.pending>0&&[`${todo.pending} đơn chờ xác nhận`,'/admin/orders?status=PENDING'],can('order.edit_location')&&todo.missing_location>0&&[`${todo.missing_location} đơn thiếu vị trí`,'/admin/orders?status=NOLOC'],can('route.optimize')&&todo.ready_today>0&&[`${todo.ready_today} đơn hôm nay chờ xếp tuyến`,'/admin/dispatch'],can('route.approve')&&todo.drafts>0&&[`${todo.drafts} tuyến nháp cần duyệt`,'/admin/dispatch'],can('route.dispatch')&&todo.locked>0&&[`${todo.locked} tuyến đã chốt chờ xuất phát`,'/admin/dispatch']].filter(Boolean);
 return <><PageHead title={`Chào ${user.name.split(' ').slice(-1)[0]}`} sub="Tình hình hôm nay từ dữ liệu hệ thống."/><div className="kpis" style={{marginBottom:16}}><Kpi accent label="Đơn theo ngày giao" value={t.orders} delta={`${t.delivered_orders} đã giao`}/><Kpi label="Giá trị đơn đã giao" value={vnd(t.revenue)} delta="Không phải số tiền đã đối soát"/><Kpi label="Giao đúng hẹn" value={t.on_time_rate == null?'—':`${Math.round(t.on_time_rate*100)}%`} delta={`${t.timed} lần giao có giờ đến`}/><Kpi label="Quãng đường kế hoạch" value={`${t.planned_km.toFixed(1)} km`} delta={`${t.routes} tuyến đã chốt`}/></div><section className="panel"><div className="panel-head"><h3>Việc cần làm</h3></div><div className="panel-body stack-sm">{!actions.length?<p className="muted small">Không có việc tồn đọng trong phạm vi quyền của bạn.</p>:actions.map(([label,href])=><div key={label} className="row between"><span>{label}</span><Link className="btn secondary sm" href={href}>Mở</Link></div>)}</div></section></>;
}
export default function AdminHome(){return <RequirePerm perm="dashboard.view"><Dashboard/></RequirePerm>;}
