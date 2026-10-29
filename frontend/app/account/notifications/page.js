"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, loadToken } from '@/lib/api';
import { ago } from '@/lib/format';
import { Empty, Loading } from '@/components/ui';
export default function Notifications(){
 const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function refresh(){try{const result=await api('/api/account/notifications',{token:loadToken()});setData(result);setError('');}catch(e){setError(e.message);}}
 useEffect(()=>{refresh();const timer=setInterval(refresh,30000);return()=>clearInterval(timer);},[]);
 async function action(path,method,body){setBusy(true);try{const result=await api(path,{method,body,token:loadToken()});setData(result);setError('');window.dispatchEvent(new Event('thongvan-notifications'));}catch(e){setError(e.message);}finally{setBusy(false);}}
 if(!data && !error)return <Loading/>;
 return <div className="stack"><h1>Thông báo</h1>{error && <div className="notice bad">{error}</div>}{data && <><section className="panel panel-pad stack-sm"><div className="row between"><div><b>Thông báo trên website</b><p className="small muted">{data.enabled ? 'Đang nhận thông báo về đơn hàng và lịch bảo dưỡng. Chỉ hiển thị trên website, không gửi SMS hay email.' : 'Bật để nhận thông báo trên website về các thay đổi đơn hàng và lịch bảo dưỡng.'}</p></div><button className="btn secondary sm" disabled={busy} onClick={()=>action('/api/account/notification-consent','PATCH',{enabled:!data.enabled})}>{data.enabled?'Tắt thông báo':'Đồng ý nhận thông báo'}</button></div></section>{data.enabled && <>{data.unread>0 && <div className="row end"><button className="btn secondary sm" disabled={busy} onClick={()=>action('/api/account/notifications/read','POST')}>Đánh dấu tất cả đã đọc</button></div>}{!data.notifications.length ? <div className="panel"><Empty title="Chưa có thông báo">Các cập nhật đơn hàng sẽ xuất hiện ở đây.</Empty></div> : <div className="panel">{data.notifications.map(n=><Link key={n.id} href={n.kind==='MAINTENANCE' ? '/account/warranties' : `/account/orders/${n.order_id}`} className="row" style={{padding:'14px 18px',borderBottom:'1px solid var(--line-soft)',alignItems:'flex-start',background:n.read?undefined:'var(--signal-soft)'}}><div className="grow"><div className="strong">{n.title} · {n.code}</div>{n.body && <div className="small muted">{n.body}</div>}</div><span className="tiny faint nowrap">{ago(n.at)}</span></Link>)}</div>}</>}</>}</div>;
}
