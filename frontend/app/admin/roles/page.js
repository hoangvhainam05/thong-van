"use client";
import { useEffect, useState } from 'react';
import { api, loadToken } from '@/lib/api';
import { RequirePerm } from '@/components/Guard';
import { PageHead } from '@/components/AdminShell';
import { Field, Modal } from '@/components/ui';
import { useStore } from '@/lib/store';
const SYSTEM = ['ADMIN','MANAGER','SALES','DRIVER','CUSTOMER'];
function Roles() {
  const { actions } = useStore();
  const [roles,setRoles]=useState([]), [permissions,setPermissions]=useState([]), [edit,setEdit]=useState(null), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const token=loadToken();
  async function refresh() { try { const [r,p] = await Promise.all([api('/api/roles',{token}),api('/api/permissions',{token})]); setRoles(r); setPermissions(p); setError(''); } catch(e) { setError(e.message); } }
  useEffect(()=>{refresh();},[]);
  async function save() { setBusy(true); setError(''); try { await api('/api/roles'+(edit.id ? `/${edit.id}` : ''),{method:edit.id?'PATCH':'POST',token,body:{...(!edit.id ? {code:edit.code} : {}),name:edit.name,permissions:edit.permissions}}); setEdit(null); await actions.refreshSession(); await refresh(); } catch(e){setError(e.message);} finally{setBusy(false);} }
  async function remove(role) { if (!confirm(`Xóa vai trò ${role.name}?`)) return; try { await api(`/api/roles/${role.id}`,{method:'DELETE',token}); await refresh(); } catch(e){setError(e.message);} }
  return <><PageHead title="Vai trò và phân quyền" sub="Quyền được kiểm tra tại máy chủ cho mỗi yêu cầu."><button className="btn" onClick={()=>setEdit({code:'',name:'',permissions:[]})}>Thêm vai trò</button></PageHead>
    {error && <div className="notice bad">{error}</div>}
    <div className="panel table-wrap"><table className="table"><thead><tr><th>Mã</th><th>Tên</th><th>Số quyền</th><th></th></tr></thead><tbody>{roles.map(r=><tr key={r.id}><td>{r.code}</td><td>{r.name}</td><td>{r.permissions.length}</td><td><button className="btn ghost sm" onClick={()=>setEdit({...r,permissions:[...r.permissions]})}>Sửa quyền</button><button className="btn ghost sm" disabled={SYSTEM.includes(r.code)} onClick={()=>remove(r)}>Xóa</button></td></tr>)}</tbody></table></div>
    {edit && <Modal title={edit.id?'Sửa vai trò':'Thêm vai trò'} onClose={()=>setEdit(null)} footer={<><button className="btn secondary" onClick={()=>setEdit(null)}>Hủy</button><button className="btn" disabled={busy} onClick={save}>Lưu</button></>}><div className="stack">
      {error && <div className="notice bad">{error}</div>}<Field label="Mã vai trò"><input className="input" disabled={!!edit.id} value={edit.code} onChange={e=>setEdit({...edit,code:e.target.value.toUpperCase()})}/></Field><Field label="Tên vai trò"><input className="input" value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/></Field>
      <b>Quyền</b>{permissions.map(p=><label key={p.code} className="row"><input type="checkbox" checked={edit.permissions.includes(p.code)} disabled={edit.code==='ADMIN' && ['backoffice.access','role.manage','user.manage'].includes(p.code)} onChange={e=>setEdit({...edit,permissions:e.target.checked?[...edit.permissions,p.code]:edit.permissions.filter(x=>x!==p.code)})}/>{p.name} <span className="tiny muted">{p.code}</span></label>)}
    </div></Modal>}
  </>;
}
export default function RolesPage() { return <RequirePerm perm="role.manage"><Roles /></RequirePerm>; }
