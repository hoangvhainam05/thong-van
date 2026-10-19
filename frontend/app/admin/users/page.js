"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { ROLES } from "@/lib/rbac";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Avatar, Field, Modal, RoleChip, Tabs } from "@/components/ui";

function Users() {
  const { state, user: me, actions } = useStore();
  const [tab, setTab] = useState("staff");
  const [edit, setEdit] = useState(null);
  const staff = state.users.filter((u) => u.role !== "CUSTOMER");
  const list = tab === "staff" ? staff : tab === "CUSTOMER" ? state.users.filter((u) => u.role === "CUSTOMER") : state.users.filter((u) => u.role === tab);

  const save = () => {
    if (!edit.name || !edit.email || !edit.phone) return;
    actions.saveUser(edit);
    setEdit(null);
  };

  return (
    <>
      <PageHead title="Tài khoản" sub="Mỗi tài khoản gắn với một vai trò. Quyền của vai trò chỉnh ở trang Phân quyền.">
        <button className="btn" onClick={() => setEdit({ name: "", email: "", phone: "", role: "SALES", password: "" })}>Tạo tài khoản nhân viên</button>
      </PageHead>
      <div className="kpis" style={{ marginBottom: 16 }}>
        {Object.entries(ROLES).map(([k, r]) => (
          <div key={k} className="kpi">
            <div className="row between"><RoleChip role={k} /><b>{state.users.filter((u) => u.role === k).length}</b></div>
            <div className="tiny muted" style={{ marginTop: 8 }}>{r.desc}</div>
          </div>
        ))}
      </div>
      <div className="panel">
        <div style={{ padding: "0 12px" }}>
          <Tabs value={tab} onChange={setTab} items={[
            { value: "staff", label: "Nhân viên", count: staff.length },
            ...["ADMIN", "MANAGER", "SALES", "DRIVER", "CUSTOMER"].map((k) => ({ value: k, label: ROLES[k].label, count: state.users.filter((u) => u.role === k).length })),
          ]} />
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Người dùng</th><th>Email</th><th>Điện thoại</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td><div className="row" style={{ flexWrap: "nowrap" }}><Avatar name={u.name} /><b>{u.name}</b>{u.id === me.id && <span className="tiny muted">(bạn)</span>}</div></td>
                  <td className="small">{u.email}</td>
                  <td className="small">{u.phone}</td>
                  <td><RoleChip role={u.role} /></td>
                  <td>{u.active ? <span className="badge ok">Hoạt động</span> : <span className="badge bad">Đã khoá</span>}</td>
                  <td className="nowrap">
                    <button className="btn ghost sm" onClick={() => setEdit({ ...u, password: "" })}>Sửa</button>
                    <button className="btn ghost sm" disabled={u.id === me.id} onClick={() => actions.toggleUser(u.id)}>{u.active ? "Khoá" : "Mở khoá"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {edit && (
        <Modal title={edit.id ? "Sửa tài khoản" : "Tạo tài khoản nhân viên"} onClose={() => setEdit(null)}
          footer={<><button className="btn secondary" onClick={() => setEdit(null)}>Huỷ</button><button className="btn" onClick={save}>Lưu tài khoản</button></>}>
          <div className="form-grid">
            <Field label="Họ tên" full><input className="input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Email đăng nhập"><input className="input" type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} /></Field>
            <Field label="Số điện thoại"><input className="input" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} /></Field>
            <Field label="Vai trò" hint={ROLES[edit.role].desc} full>
              <select className="input" value={edit.role} disabled={edit.id === me.id || edit.role === "CUSTOMER"} onChange={(e) => setEdit({ ...edit, role: e.target.value })}>
                {Object.entries(ROLES).filter(([k]) => k !== "CUSTOMER" || edit.role === "CUSTOMER").map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
              </select>
            </Field>
            {!edit.id && <Field label="Mật khẩu ban đầu" hint="Để trống sẽ dùng 123456" full><input className="input" type="text" value={edit.password} onChange={(e) => setEdit({ ...edit, password: e.target.value })} /></Field>}
            {edit.id === me.id && <p className="small muted full">Bạn không thể tự đổi vai trò hoặc tự khoá tài khoản của mình.</p>}
          </div>
        </Modal>
      )}
    </>
  );
}

export default function UsersPage() {
  return <RequirePerm perm="user.manage"><Users /></RequirePerm>;
}
