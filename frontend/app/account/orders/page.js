"use client";
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, loadToken } from '@/lib/api';
import { dateLabel, vnd } from '@/lib/format';
import { Empty, Loading, OrderBadge, Tabs } from '@/components/ui';
const GROUPS={active:['PENDING','CONFIRMED','READY','SCHEDULED','OUT_FOR_DELIVERY'],done:['DELIVERED'],other:['CANCELLED','FAILED']};
export default function MyOrders(){
 const [tab,setTab]=useState('active'),[orders,setOrders]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let mounted=true;async function refresh(){try{const data=await api('/api/account/orders',{token:loadToken()});if(mounted){setOrders(data);setError('');}}catch(e){if(mounted)setError(e.message);}finally{if(mounted)setLoading(false);}}refresh();const timer=setInterval(refresh,30000);return()=>{mounted=false;clearInterval(timer);};},[]);
 if(loading)return <Loading/>;
 return <div className="stack"><h1>Đơn hàng của tôi</h1>{error && <div className="notice bad">{error}</div>}<Tabs value={tab} onChange={setTab} items={[{value:'active',label:'Đang xử lý',count:orders.filter(o=>GROUPS.active.includes(o.status)).length},{value:'done',label:'Đã giao',count:orders.filter(o=>GROUPS.done.includes(o.status)).length},{value:'other',label:'Hủy hoặc chưa giao được',count:orders.filter(o=>GROUPS.other.includes(o.status)).length}]}/>{orders.filter(o=>GROUPS[tab].includes(o.status)).length===0 ? <div className="panel"><Empty title="Chưa có đơn nào ở đây" action={<Link className="btn" href="/products">Mua sắm</Link>}/></div> : orders.filter(o=>GROUPS[tab].includes(o.status)).map(o=><Link key={o.id} href={`/account/orders/${o.id}`} className="panel panel-pad stack-sm" style={{display:'flex'}}><div className="row between"><div className="row"><b>{o.code}</b><OrderBadge status={o.status}/></div><span className="price">{vnd(o.total)}</span></div><div className="small muted">{o.items.map(i=>`${i.name} × ${i.quantity}`).join(', ')}</div><div className="small">Giao {dateLabel(o.delivery_date).toLowerCase()}, khung giờ {o.time_window}</div></Link>)}</div>;
}
