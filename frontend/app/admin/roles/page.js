"use client";

import { Fragment } from "react";
import { useStore } from "@/lib/store";
import { LOCKED, PERMISSION_GROUPS, ROLES } from "@/lib/rbac";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { RoleChip } from "@/components/ui";

function Roles() {
  const { state, actions } = useStore();
  const roles = Object.keys(ROLES);
  return (
    <>
      <PageHead title="Phân quyền" sub="Bật hoặc tắt từng quyền cho mỗi vai trò. Thay đổi áp dụng ngay cho mọi tài khoản thuộc vai trò đó.">
        <button className="btn secondary" onClick={() => confirm("Khôi phục ma trận phân quyền mặc định?") && actions.resetMatrix()}>Khôi phục mặc định</button>
      </PageHead>
      <div className="panel table-wrap">
        <table className="table matrix">
          <thead>
            <tr>
              <th>Quyền</th>
              {roles.map((r) => <th key={r} className="role"><RoleChip role={r} /></th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((g) => (
              <Fragment key={g.group}>
                <tr className="grp"><td colSpan={roles.length + 1}>{g.group}</td></tr>
                {g.items.map(([perm, label]) => (
                  <tr key={perm}>
                    <td>{label}<div className="tiny faint">{perm}</div></td>
                    {roles.map((r) => {
                      const locked = LOCKED[r]?.includes(perm);
                      return (
                        <td key={r} className="cell">
                          <input type="checkbox" checked={state.roleMatrix[r].includes(perm)} disabled={locked}
                            title={locked ? "Khoá để tránh mất quyền quản trị" : undefined}
                            aria-label={`${ROLES[r].label}: ${label}`} onChange={() => actions.togglePermission(r, perm)} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="notice">
          Giao diện kiểm tra quyền, không kiểm tra tên vai trò: tắt “Xem tất cả đơn hàng” của Nhân viên bán hàng thì menu Đơn hàng biến mất và trang đơn hàng trả về màn hình không có quyền.
        </div>
        <div className="notice warn">
          Phạm vi dữ liệu luôn được giới hạn thêm: khách hàng chỉ thấy đơn của mình, tài xế chỉ cập nhật được tuyến được giao cho mình, dù có quyền tương ứng.
        </div>
      </div>
    </>
  );
}

export default function RolesPage() {
  return <RequirePerm perm="role.manage"><Roles /></RequirePerm>;
}
