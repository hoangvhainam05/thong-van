"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useCategories } from "@/lib/categories";
import { vnd } from "@/lib/format";
import { api, loadToken } from "@/lib/api";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import Art from "@/components/Art";
import { Field, Modal } from "@/components/ui";

const EMPTY = { name: "", brand: "", category: "", costPrice: null, price: 0, oldPrice: null, volume: 0.3, weight: 20, install: 15, warranty: 12, maintenanceIntervalMonths: null, stock: 10, active: true, description: "" };

function Products() {
  const { state, actions } = useStore();
  const { categories, error: categoryError, reload: reloadCategories } = useCategories();
  const [managingCategories, setManagingCategories] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryEdit, setCategoryEdit] = useState(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [imagePreview, setImagePreview] = useState("");
  const list = state.products.filter((p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())));

  useEffect(() => {
    const savedToken = loadToken();
    if (!savedToken) return;
    setToken(savedToken);
    actions.loadProducts(savedToken).then((ok) => {
      setConnected(ok);
      if (!ok) setConnectionError("Không tải được danh sách quản trị. Kiểm tra quyền tài khoản và backend.");
      else actions.loadOrders(savedToken);
    });
  }, []);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return undefined;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const uploadImage = async (file) => {
    const signed = await api("/api/products/admin/upload-signature", { method: "POST", token });
    const body = new FormData();
    body.append("api_key", signed.apiKey);
    body.append("timestamp", String(signed.timestamp));
    body.append("folder", signed.folder);
    body.append("signature", signed.signature);
    body.append("file", file);
    const response = await fetch(signed.uploadUrl, { method: "POST", body });
    const result = await response.json();
    if (!response.ok || !result.secure_url) throw new Error(result.error?.message || "Cloudinary không nhận được ảnh.");
    return { imageUrl: result.secure_url, imagePublicId: result.public_id };
  };

  const save = async () => {
    if (!edit.name || !edit.brand || !edit.category || edit.price <= 0 || (edit.costPrice !== null && edit.costPrice !== "" && Number(edit.costPrice) < 0)) { setConnectionError("Vui lòng nhập tên, hãng, danh mục, giá bán hợp lệ và giá nhập không âm."); return; }
    if (!connected) return;
    if (imageFile && (!imageFile.type.startsWith("image/") || imageFile.size > 5 * 1024 * 1024)) {
      setConnectionError("Ảnh phải là định dạng hình ảnh và nhỏ hơn 5 MB.");
      return;
    }
    setSaving(true);
    setConnectionError("");
    try {
      const image = imageFile ? await uploadImage(imageFile) : { imageUrl: edit.imageUrl, imagePublicId: edit.imagePublicId };
      const saved = await actions.saveProduct({ ...edit, ...image, price: Number(edit.price), costPrice: edit.costPrice === "" || edit.costPrice == null ? null : Number(edit.costPrice), oldPrice: edit.oldPrice ? Number(edit.oldPrice) : null, volume: Number(edit.volume), weight: Number(edit.weight), install: Number(edit.install), stock: Number(edit.stock), warranty: Number(edit.warranty), maintenanceIntervalMonths: edit.maintenanceIntervalMonths ? Number(edit.maintenanceIntervalMonths) : null });
      if (!saved) return;
      setEdit(null);
      setImageFile(null);
    } catch (error) {
      setConnectionError(error.message || "Không lưu được sản phẩm.");
    } finally {
      setSaving(false);
    }
  };
  const saveCategory = async () => {
    if (!categoryName.trim()) { setConnectionError("Vui lòng nhập tên danh mục."); return; }
    setCategorySaving(true);
    try {
      await api(categoryEdit ? `/api/categories/${encodeURIComponent(categoryEdit.id)}` : "/api/categories", { method: categoryEdit ? "PATCH" : "POST", body: { name: categoryName.trim() }, token });
      await reloadCategories(); setCategoryName(""); setCategoryEdit(null); setConnectionError("");
    } catch (error) { setConnectionError(error.message); }
    finally { setCategorySaving(false); }
  };
  const deleteCategory = async (category) => {
    if (!window.confirm(`Xóa danh mục “${category.name}”?`)) return;
    try {
      await api(`/api/categories/${encodeURIComponent(category.id)}`, { method: "DELETE", token });
      await reloadCategories(); if (cat === category.id) setCat(""); setConnectionError("");
    } catch (error) { setConnectionError(error.message); }
  };
  const set = (k) => (e) => setEdit({ ...edit, [k]: e.target.value });

  return (
    <>
      <PageHead title="Sản phẩm" sub="Thể tích và thời gian lắp đặt được dùng để tính sức chứa xe và giờ giao.">
        <input className="input" style={{ width: 220 }} placeholder="Tìm tên hoặc mã" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm sản phẩm" />
        <select className="input" style={{ width: 170 }} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Danh mục">
          <option value="">Mọi danh mục</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn secondary" disabled={!connected} onClick={() => setManagingCategories(true)}>Quản lý danh mục</button>
        <button className="btn" disabled={!connected || !categories.length} onClick={() => { setImageFile(null); setEdit({ ...EMPTY, category: categories[0]?.id || "" }); }}>Thêm sản phẩm</button>
      </PageHead>
      {(connectionError || categoryError) && <div className="notice bad" style={{ marginBottom: 14 }}>{connectionError || categoryError}</div>}
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Sản phẩm</th><th>Danh mục</th><th className="num">Giá nhập</th><th className="num">Giá bán</th><th className="num">Tồn kho</th><th className="num">Thể tích</th><th className="num">Lắp đặt</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
                <td>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <span style={{ width: 36, height: 36, color: "var(--road)", flex: "none" }}>{p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6 }} /> : <Art category={p.category} />}</span>
                    <div><div className="strong">{p.name}</div><div className="tiny muted">{p.sku}</div></div>
                  </div>
                </td>
                <td className="small">{categories.find((c) => c.id === p.category)?.name}</td>
                <td className="num">{p.costPrice == null ? "—" : vnd(p.costPrice)}</td>
                <td className="num">{vnd(p.price)}{p.oldPrice && <div className="strike">{vnd(p.oldPrice)}</div>}</td>
                <td className="num" style={{ color: p.stock === 0 ? "var(--stop)" : p.stock < 5 ? "var(--move)" : undefined, fontWeight: p.stock < 5 ? 700 : 400 }}>{p.stock}</td>
                <td className="num">{p.volume} m³</td>
                <td className="num">{p.install ? `${p.install} phút` : "—"}</td>
                <td>{p.active ? <span className="badge ok">Đang bán</span> : <span className="badge">Đã ẩn</span>}</td>
                <td className="nowrap">
                  <button className="btn ghost sm" disabled={!connected} onClick={() => { setImageFile(null); setEdit({ ...p }); }}>Sửa</button>
                  <button className="btn ghost sm" disabled={!connected} onClick={() => actions.toggleProduct(p.id)}>{p.active ? "Ẩn" : "Mở bán"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {managingCategories && (
        <Modal title="Quản lý danh mục" onClose={() => setManagingCategories(false)} footer={<button className="btn secondary" onClick={() => setManagingCategories(false)}>Đóng</button>}>
          {connectionError && <div className="notice bad" role="alert">{connectionError}</div>}
          <div className="row" style={{ marginBottom: 16 }}>
            <input className="input" aria-label="Tên danh mục" placeholder="Tên danh mục" value={categoryName} onChange={(e) => setCategoryName(e.target.value)} />
            <button className="btn" disabled={categorySaving} onClick={saveCategory}>{categoryEdit ? "Lưu" : "Thêm"}</button>
            {categoryEdit && <button className="btn secondary" onClick={() => { setCategoryEdit(null); setCategoryName(""); }}>Huỷ sửa</button>}
          </div>
          <div className="table-wrap"><table className="table"><thead><tr><th>Danh mục</th><th></th></tr></thead><tbody>
            {categories.map((c) => <tr key={c.id}><td>{c.name}</td><td className="nowrap"><button className="btn ghost sm" onClick={() => { setCategoryEdit(c); setCategoryName(c.name); }}>Sửa</button><button className="btn ghost sm" onClick={() => deleteCategory(c)}>Xóa</button></td></tr>)}
          </tbody></table></div>
        </Modal>
      )}
      {edit && (
        <Modal wide title={edit.id ? "Sửa sản phẩm" : "Thêm sản phẩm"} onClose={() => setEdit(null)}
          footer={<><button className="btn secondary" onClick={() => { setEdit(null); setImageFile(null); }}>Huỷ</button><button className="btn" disabled={saving} onClick={save}>{saving ? "Đang lưu…" : "Lưu sản phẩm"}</button></>}>
          <div className="form-grid">
            <Field label="Tên sản phẩm" full><input className="input" value={edit.name} onChange={set("name")} /></Field>
            <Field label="Hãng"><input className="input" value={edit.brand} onChange={set("brand")} /></Field>
            <Field label="Danh mục">
              <select className="input" value={edit.category} onChange={set("category")}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </Field>
            <Field label="Giá nhập (₫)" hint="Để trống nếu chưa biết"><input className="input" type="number" min="0" step="1" value={edit.costPrice ?? ""} onChange={set("costPrice")} /></Field>
            <Field label="Giá bán (₫)"><input className="input" type="number" min="0" step="10000" value={edit.price} onChange={set("price")} /></Field>
            <Field label="Giá trước giảm (₫)" hint="Để trống nếu không giảm giá"><input className="input" type="number" min="0" step="10000" value={edit.oldPrice ?? ""} onChange={set("oldPrice")} /></Field>
            <Field label="Tồn kho"><input className="input" type="number" min="0" value={edit.stock} onChange={set("stock")} /></Field>
            <Field label="Bảo hành (tháng)"><input className="input" type="number" min="0" value={edit.warranty} onChange={set("warranty")} /></Field>
            <Field label="Chu kỳ bảo dưỡng (tháng)" hint="Để trống nếu chưa có lịch khuyến nghị"><input className="input" type="number" min="1" max="120" value={edit.maintenanceIntervalMonths ?? ""} onChange={set("maintenanceIntervalMonths")} /></Field>
            <Field label="Thể tích đóng gói (m³)" hint="Dùng tính sức chứa xe"><input className="input" type="number" min="0" step="0.01" value={edit.volume} onChange={set("volume")} /></Field>
            <Field label="Thời gian lắp đặt (phút)" hint="Dùng tính giờ đến các điểm sau"><input className="input" type="number" min="0" value={edit.install} onChange={set("install")} /></Field>
            <Field label="Mô tả" full><textarea className="input" rows={3} value={edit.description} onChange={set("description")} /></Field>
            <Field label="Ảnh sản phẩm" full>
              <div className="stack-sm">
                <input className="input" type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
                <span className="tiny muted">Tối đa 5 MB. Ảnh được tải lên Cloudinary khi lưu sản phẩm.</span>
                {(imagePreview || edit.imageUrl) && <img src={imagePreview || edit.imageUrl} alt="Xem trước sản phẩm" style={{ width: 120, height: 90, objectFit: "cover", borderRadius: 8 }} />}
              </div>
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}

export default function ProductsAdmin() {
  return <RequirePerm perm="product.manage"><Products /></RequirePerm>;
}
