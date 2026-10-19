"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { dateLabel, vnd, vndShort } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import { Modal, OrderBadge } from "@/components/ui";

function Customers() {
  const { state } = useStore();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("spent");
  const [open, setOpen] = useState(null);

  const rows = useMemo(() => state.customers.map((c) => {
    const orders = state.orders.filter((o) => o.customerId === c.id);
    const spent = orders.filter((o) => o.status === "DELIVERED").reduce((s, o) => s + o.total, 0);
    const last = orders.map((o) => o.deliveryDate).sort().at(-1);
    return { c, orders, spent, last, hasAccount: state.users.some((u) => u.customerId === c.id) };
  }), [state.customers, state.orders, state.users]);

  const list = rows
    .filter(({ c }) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.phone.includes(q))
    .sort((a, b) => (sort === "spent" ? b.spent - a.spent : sort === "orders" ? b.orders.length - a.orders.length : (b.last || "").localeCompare(a.last || "")));
  const detail = open && rows.find((r) => r.c.id === open);

  return (
    <>
      <PageHead title="Khách hàng" sub={`${state.customers.length} khách, ${rows.filter((r) => r.hasAccount).length} khách có tài khoản.`}>
        <input className="input" style={{ width: 240 }} placeholder="Tìm tên hoặc số điện thoại" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm khách" />
        <select className="input" style={{ width: 190 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sắp xếp">
          <option value="spent">Chi tiêu nhiều nhất</option>
          <option value="orders">Nhiều đơn nhất</option>
          <option value="recent">Mua gần đây</option>
        </select>
      </PageHead>
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Khách hàng</th><th>Khu vực</th><th className="num">Số đơn</th><th className="num">Đã chi</th><th>Đơn gần nhất</th><th>Tài khoản</th></tr></thead>
          <tbody>
            {list.map(({ c, orders, spent, last, hasAccount }) => (
              <tr key={c.id} onClick={() => setOpen(c.id)} style={{ cursor: "pointer" }}>
                <td><b>{c.name}</b><div className="tiny muted">{c.phone}</div></td>
                <td className="small">{c.addresses[0]?.district || "—"}</td>
                <td className="num">{orders.length}</td>
                <td className="num">{vndShort(spent)}</td>
                <td className="small">{last ? dateLabel(last) : "—"}</td>
                <td>{hasAccount ? <span className="badge info plain">Có</span> : <span className="tiny muted">Đặt qua điện thoại</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {detail && (
        <Modal wide title={detail.c.name} onClose={() => setOpen(null)}>
          <div className="stack">
            <div className="small muted">{detail.c.phone}{detail.c.email ? ` · ${detail.c.email}` : ""} · đã chi {vnd(detail.spent)}</div>
            <div className="stack-sm">
              <b className="small">Địa chỉ</b>
              {detail.c.addresses.map((a) => <div key={a.id} className="small">{a.label}: {a.address}</div>)}
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead><tr><th>Đơn</th><th>Ngày giao</th><th className="num">Tổng</th><th>Trạng thái</th></tr></thead>
                <tbody>
                  {detail.orders.sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate)).map((o) => (
                    <tr key={o.id}>
                      <td><Link href={`/admin/orders/${o.id}`} style={{ color: "var(--road)", fontWeight: 600 }}>{o.code}</Link></td>
                      <td>{dateLabel(o.deliveryDate)}</td>
                      <td className="num">{vnd(o.total)}</td>
                      <td><OrderBadge status={o.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function CustomersPage() {
  return <RequirePerm perm="customer.view"><Customers /></RequirePerm>;
}
