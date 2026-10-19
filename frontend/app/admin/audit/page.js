"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { dateTime } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Empty, RoleChip } from "@/components/ui";

function Audit() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const list = state.audit.filter((a) => !q || `${a.user} ${a.action} ${a.detail}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHead title="Nhật ký thao tác" sub="Ai đã làm gì và khi nào: xác nhận đơn, chốt tuyến, đổi phân quyền.">
        <input className="input" style={{ width: 260 }} placeholder="Lọc theo người, hành động" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Lọc nhật ký" />
      </PageHead>
      <div className="panel table-wrap">
        {list.length === 0 ? <Empty title="Chưa có thao tác nào" /> : (
          <table className="table">
            <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Hành động</th><th>Chi tiết</th></tr></thead>
            <tbody>
              {list.map((a, i) => (
                <tr key={i}>
                  <td className="nowrap small">{dateTime(a.at)}</td>
                  <td className="nowrap">{a.user} {a.role && <RoleChip role={a.role} />}</td>
                  <td className="strong small">{a.action}</td>
                  <td className="small muted">{a.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export default function AuditPage() {
  return <RequirePerm perm="audit.view"><Audit /></RequirePerm>;
}
