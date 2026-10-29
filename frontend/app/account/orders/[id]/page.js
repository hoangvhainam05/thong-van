"use client";
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { api, loadToken } from '@/lib/api';
import RemoteTracking from '@/components/RemoteTracking';
import { Loading } from '@/components/ui';
function Detail(){
 const {id}=useParams(), params=useSearchParams();const [tracking,setTracking]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{let mounted=true;async function refresh(){try{const data=await api(`/api/account/orders/${encodeURIComponent(id)}`,{token:loadToken()});if(mounted){setTracking(data);setError('');}}catch(e){if(mounted){setTracking(null);setError(e.message);}}finally{if(mounted)setLoading(false);}}refresh();const timer=setInterval(refresh,30000);return()=>{mounted=false;clearInterval(timer);};},[id]);
 if(loading)return <Loading/>;
 return <div className="stack"><Link href="/account/orders" className="small muted">‹ Đơn hàng của tôi</Link>{error && <div className="notice bad">{error}</div>}{tracking && <>{params.get('new') && <div className="notice ok">Đặt hàng thành công. Mã đơn của bạn là <b>{tracking.code}</b>.</div>}<RemoteTracking tracking={tracking} proofRequest={{path:`/api/account/orders/${id}/proof`,options:{token:loadToken()}}}/></>}</div>;
}
export default function OrderDetailPage(){return <Suspense fallback={<Loading/>}><Detail/></Suspense>;}
