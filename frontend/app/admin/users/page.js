"use client";
import { useEffect, useState } from "react";
import { api, loadToken } from "@/lib/api";
import { useStore } from "@/lib/store";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Field, Modal, RoleChip } from "@/components/ui";

function Users() {
  const { user: me } = useStore();
  const [users, setUsers] = useState([]), [roles, setRoles] = useState([]), [drivers, setDrivers] = useState([]), [edit, setEdit] = useState(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const token = loadToken();
  async function refresh() {
    try {
      const [list, roleList, driverList] = await Promise.all([api('/api/users', { token }), api('/api/roles/options', { token }), api('/api/users/driver-options', { token })]);
      setUsers(list); setRoles(roleList); setDrivers(driverList); setError('');
    } catch (e) { setError(e.message); }
  }
  useEffect(() => { refresh(); }, []);
  async function save() {
    setBusy(true); setError('');
    try {
      const body = { name: edit.name, email: edit.email || undefined, phone: edit.phone || undefined, role: edit.role, driverId: edit.driverId ? Number(edit.driverId) : null, ...(edit.password ? { password: edit.password } : {}) };
      await api('/api/users' + (edit.id ? `/${edit.id}` : ''), { method: edit.id ? 'PATCH' : 'POST', body, token });
      setEdit(null); await refresh();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  async function change(id, method, body) { setError(''); try { await api(`/api/users/${id}`, { method, body, token }); await refresh(); } catch(e) { setError(e.message); } }
  return <>
    <PageHead title="Tài khoản" sub="Tài khoản và vai trò được lưu trong cơ sở dữ liệu."><button className="btn" onClick={() => setEdit({ name:'', email:'', phone:'', role:'SALES', password:'' })}>Tạo tài khoản</button></PageHead>
    {error && <div className="notice bad">{error}</div>}
    <div className="panel table-wrap"><table className="table"><thead><tr><th>Họ tên</th><th>Email</th><th>Điện thoại</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead><tbody>
      {users.map(u => <tr key={u.id}><td>{u.name}</td><td>{u.email || '—'}</td><td>{u.phone || '—'}</td><td><RoleChip role={u.role} /></td><td>{u.active ? 'Hoạt động' : 'Đã khóa'}</td><td className="nowrap">
        <button className="btn ghost sm" onClick={() => setEdit({ ...u, email:u.email || '', phone:u.phone || '', password:'' })}>Sửa</button>
        <button className="btn ghost sm" disabled={u.id === me.id} onClick={() => change(u.id,'PATCH',{active:!u.active})}>{u.active ? 'Khóa' : 'Mở khóa'}</button>
        <button className="btn ghost sm" disabled={u.id === me.id} onClick={() => confirm(`Xóa tài khoản ${u.name}?`) && change(u.id,'DELETE')}>Xóa</button>
      </td></tr>)}
    </tbody></table></div>
    {edit && <Modal title={edit.id ? 'Sửa tài khoản' : 'Tạo tài khoản'} onClose={() => setEdit(null)} footer={<><button className="btn secondary" onClick={() => setEdit(null)}>Hủy</button><button className="btn" disabled={busy} onClick={save}>Lưu</button></>}>
      <div className="form-grid">{error && <div className="notice bad full">{error}</div>}<Field label="Họ tên" full><input className="input" value={edit.name} onChange={e=>setEdit({...edit,name:e.target.value})}/></Field>
      <Field label="Email"><input className="input" type="email" value={edit.email} onChange={e=>setEdit({...edit,email:e.target.value})}/></Field>
      <Field label="Điện thoại"><input className="input" value={edit.phone} onChange={e=>setEdit({...edit,phone:e.target.value})}/></Field>
      <Field label="Vai trò" full><select className="input" value={edit.role} disabled={edit.id===me.id} onChange={e=>setEdit({...edit,role:e.target.value})}>{roles.map(r=><option key={r.code} value={r.code}>{r.name}</option>)}</select></Field>
      <Field label="Liên kết tài xế" hint="Cần liên kết để tài xế xem và cập nhật tuyến được giao." full><select className="input" value={edit.driverId || ''} onChange={e=>setEdit({...edit,driverId:e.target.value})}><option value="">Chưa liên kết</option>{drivers.filter(d => d.active && (!d.userId || d.userId === edit.id)).map(d=><option key={d.id} value={d.id}>{d.name} — {d.phone}</option>)}</select></Field>
      <Field label={edit.id ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu ban đầu'} hint="Tối thiểu 8 ký tự" full><input className="input" type="password" value={edit.password} onChange={e=>setEdit({...edit,password:e.target.value})}/></Field></div>
    </Modal>}
  </>;
}
export default function UsersPage() { return <RequirePerm perm="user.manage"><Users /></RequirePerm>; }
