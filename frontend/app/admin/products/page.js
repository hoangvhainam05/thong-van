"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/mock/catalog";
import { vnd } from "@/lib/format";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import Art from "@/components/Art";
import { Field, Modal } from "@/components/ui";

const EMPTY = { name: "", brand: "", category: "may-giat", price: 0, oldPrice: null, volume: 0.3, weight: 20, install: 15, warranty: 12, stock: 10, active: true, description: "" };

function Products() {
  const { state, actions } = useStore();
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const list = state.products.filter((p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())));

  const save = () => {
    if (!edit.name || !edit.brand || edit.price <= 0) return;
    actions.saveProduct({ ...edit, price: Number(edit.price), oldPrice: edit.oldPrice ? Number(edit.oldPrice) : null, volume: Number(edit.volume), weight: Number(edit.weight), install: Number(edit.install), stock: Number(edit.stock), warranty: Number(edit.warranty) });
    setEdit(null);
  };
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  return (
    <>
      <PageHead title="Sản phẩm" sub="Thể tích và thời gian lắp đặt được dùng để tính sức chứa xe và giờ giao.">
        <input className="input" style={{ width: 220 }} placeholder="Tìm tên hoặc mã" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm sản phẩm" />
        <select className="input" style={{ width: 170 }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Danh mục">
          <option value="">Mọi danh mục</option>
          {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn" onClick={() => setEdit({ ...EMPTY })}>Thêm sản phẩm</button>
      </PageHead>
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Sản phẩm</th><th>Danh mục</th><th className="num">Giá bán</th><th className="num">Tồn kho</th><th className="num">Thể tích</th><th className="num">Lắp đặt</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
                <td>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <span style={{ width: 36, height: 36, color: "var(--road)", flex: "none" }}><Art category={p.category} /></span>
                    <div><div className="strong">{p.name}</div><div className="tiny muted">{p.sku}</div></div>
                  </div>
                </td>
                <td className="small">{CATEGORIES.find((c) => c.id === p.category)?.name}</td>
                <td className="num">{vnd(p.price)}{p.oldPrice && <div className="strike">{vnd(p.oldPrice)}</div>}</td>
                <td className="num" style={{ color: p.stock === 0 ? "var(--stop)" : p.stock < 5 ? "var(--move)" : undefined, fontWeight: p.stock < 5 ? 700 : 400 }}>{p.stock}</td>
                <td className="num">{p.volume} m³</td>
                <td className="num">{p.install ? `${p.install} phút` : "—"}</td>
                <td>{p.active ? <span className="badge ok">Đang bán</span> : <span className="badge">Đã ẩn</span>}</td>
                <td className="nowrap">
                  <button className="btn ghost sm" onClick={() => setEdit({ ...p })}>Sửa</button>
                  <button className="btn ghost sm" onClick={() => actions.toggleProduct(p.id)}>{p.active ? "Ẩn" : "Mở bán"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <Modal wide title={edit.id ? "Sửa sản phẩm" : "Thêm sản phẩm"} onClose={() => setEdit(null)}
          footer={<><button className="btn secondary" onClick={() => setEdit(null)}>Huỷ</button><button className="btn" onClick={save}>Lưu sản phẩm</button></>}>
          <div className="form-grid">
            <Field label="Tên sản phẩm" full><input className="input" value={edit.name} onChange={set("name")} /></Field>
            <Field label="Hãng"><input className="input" value={edit.brand} onChange={set("brand")} /></Field>
            <Field label="Danh mục">
              <select className="input" value={edit.category} onChange={set("category")}>{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </Field>
            <Field label="Giá bán (₫)"><input className="input" type="number" min="0" step="10000" value={edit.price} onChange={set("price")} /></Field>
            <Field label="Giá trước giảm (₫)" hint="Để trống nếu không giảm giá"><input className="input" type="number" min="0" step="10000" value={edit.oldPrice ?? ""} onChange={set("oldPrice")} /></Field>
            <Field label="Tồn kho"><input className="input" type="number" min="0" value={edit.stock} onChange={set("stock")} /></Field>
            <Field label="Bảo hành (tháng)"><input className="input" type="number" min="0" value={edit.warranty} onChange={set("warranty")} /></Field>
            <Field label="Thể tích đóng gói (m³)" hint="Dùng tính sức chứa xe"><input className="input" type="number" min="0" step="0.01" value={edit.volume} onChange={set("volume")} /></Field>
            <Field label="Thời gian lắp đặt (phút)" hint="Dùng tính giờ đến các điểm sau"><input className="input" type="number" min="0" value={edit.install} onChange={set("install")} /></Field>
            <Field label="Mô tả" full><textarea className="input" rows={3} value={edit.description} onChange={set("description")} /></Field>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function ProductsAdmin() {
  return <RequirePerm perm="product.manage"><Products /></RequirePerm>;
}
