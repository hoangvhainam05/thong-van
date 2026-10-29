"use client";
import { useEffect,useState } from 'react';
import { api,loadToken } from '@/lib/api';
import { dateLabel,vnd } from '@/lib/format';
import { RequirePerm } from '@/components/Guard';
import { PageHead } from '@/components/AdminShell';
import { Loading } from '@/components/ui';
function Customers(){
 const [rows,setRows]=useState(null),[error,setError]=useState(''),[q,setQ]=useState('');
 useEffect(()=>{api('/api/admin/customers',{token:loadToken()}).then(setRows).catch(e=>setError(e.message));},[]);
 return <><PageHead title="Khách hàng" sub="Tối đa 500 khách gần nhất theo mã khách."><input className="input" placeholder="Tìm tên hoặc số điện thoại" value={q} onChange={e=>setQ(e.target.value)} aria-label="Tìm khách"/></PageHead>{error?<div className="notice bad">{error}</div>:!rows?<Loading/>:<div className="panel table-wrap"><table className="table"><thead><tr><th>Khách hàng</th><th>Email</th><th>Số đơn</th><th>Giá trị đã giao</th><th>Ngày giao gần nhất</th><th>Tài khoản</th></tr></thead><tbody>{rows.filter(c=>!q||c.name.toLowerCase().includes(q.toLowerCase())||c.phone.includes(q)).map(c=><tr key={c.id}><td><b>{c.name}</b><div className="tiny muted">{c.phone}</div></td><td>{c.email||'—'}</td><td>{c.orders}</td><td>{vnd(c.spent)}</td><td>{c.last_delivery?dateLabel(c.last_delivery):'—'}</td><td>{c.has_account?'Có':'Chưa có'}</td></tr>)}</tbody></table></div>}</>;
}
export default function CustomersPage(){return <RequirePerm perm="customer.view"><Customers/></RequirePerm>;}
