"use client";
import { useEffect,useState } from 'react';
import { api,loadToken } from '@/lib/api';
import { dateTime } from '@/lib/format';
import { RequirePerm } from '@/components/Guard';
import { PageHead } from '@/components/AdminShell';
import { Empty,Loading,RoleChip } from '@/components/ui';
function Audit(){
 const [items,setItems]=useState(null),[before,setBefore]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(cursor){setBusy(true);try{const result=await api(`/api/admin/audit?limit=50${cursor?`&before=${encodeURIComponent(cursor)}`:''}`,{token:loadToken()});setItems(prev=>cursor?[...(prev||[]),...result.items]:result.items);setBefore(result.next_before);setError('');}catch(e){setError(e.message);}finally{setBusy(false);}}
 useEffect(()=>{load();},[]);
 return <><PageHead title="Nhật ký thao tác" sub="Các thao tác thay đổi đã xác thực; không lưu mật khẩu hay nội dung yêu cầu."/>{error&&<div className="notice bad">{error}</div>}{!items&&!error?<Loading/>:!items?.length?<div className="panel"><Empty title="Chưa có thao tác nào"/></div>:<><div className="panel table-wrap"><table className="table"><thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Thao tác API</th></tr></thead><tbody>{items.map(a=><tr key={a.id}><td className="nowrap small">{dateTime(a.created_at)}</td><td>{a.actor_name} <RoleChip role={a.actor_role}/></td><td className="small">{a.method} {a.path}{a.details && <div className="tiny muted">{Object.entries(a.details).map(([key,value])=>`${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`).join(" · ")}</div>}</td></tr>)}</tbody></table></div>{before&&<button className="btn secondary" disabled={busy} onClick={()=>load(before)}>Xem thêm</button>}</>}</>;
}
export default function AuditPage(){return <RequirePerm perm="audit.view"><Audit/></RequirePerm>;}
