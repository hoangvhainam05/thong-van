"use client";
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import RemoteTracking from '@/components/RemoteTracking';
import { Field, Loading } from '@/components/ui';
function Tracker() {
 const params=useSearchParams();
 const [code,setCode]=useState(params.get('code') || ''),[phone,setPhone]=useState(params.get('phone') || ''),[query,setQuery]=useState(null),[tracking,setTracking]=useState(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 useEffect(()=>{ if(!query)return; let active=true; async function fetchTracking(initial=false){if(initial)setLoading(true);try{const result=await api(`/api/tracking/${encodeURIComponent(query.code)}`,{method:'POST',body:{phone:query.phone}});if(active){setTracking(result);setError('');}}catch(e){if(active){setTracking(null);setError(e.status===404?'Không tìm thấy đơn với mã và số điện thoại này.':'Chưa tra cứu được đơn. Vui lòng thử lại.');}}finally{if(active && initial)setLoading(false);}}fetchTracking(true);const timer=setInterval(()=>fetchTracking(),30000);return()=>{active=false;clearInterval(timer);}; },[query]);
 function lookup(e){e.preventDefault();const q={code:code.trim().toUpperCase(),phone:phone.replace(/\s/g,'')};if(!q.code || !q.phone){setQuery(null);setTracking(null);setError('Nhập cả mã đơn và số điện thoại đã dùng khi đặt hàng.');return;}setTracking(null);setQuery(q);}
 return <div className="stack"><div><h1>Tra cứu đơn hàng</h1><p className="muted" style={{marginTop:4}}>Không cần đăng nhập. Nhập mã đơn và số điện thoại đã dùng khi đặt hàng.</p></div><form className="panel panel-pad row" style={{alignItems:'flex-end'}} onSubmit={lookup}><div className="grow"><Field label="Mã đơn"><input className="input" value={code} onChange={e=>setCode(e.target.value)} placeholder="TV101435"/></Field></div><div className="grow"><Field label="Số điện thoại"><input className="input" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="09xx xxx xxx" inputMode="tel"/></Field></div><button className="btn" disabled={loading}>{loading?'Đang tra cứu…':'Tra cứu'}</button></form>{error && <div className="notice bad">{error}</div>}{tracking && query && <RemoteTracking key={tracking.code} tracking={tracking} proofRequest={{path:`/api/tracking/${encodeURIComponent(query.code)}/proof`,options:{method:'POST',body:{phone:query.phone}}}}/>}</div>;
}
export default function TrackPage(){return <Suspense fallback={<Loading/>}><Tracker/></Suspense>;}
