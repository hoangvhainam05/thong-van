"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { useCategories } from "@/lib/categories";
import { vnd } from "@/lib/format";
import { api, loadToken } from "@/lib/api";
import { RequirePerm } from "@/components/Guard";
import { PageHead } from "@/components/AdminShell";
import Art from "@/components/Art";
import { Field, Modal } from "@/components/ui";

const EMPTY = { name: "", brand: "", category: "", costPrice: null, price: "", oldPrice: null, volume: 0.3, weight: 20, packageLengthCm: null, packageWidthCm: null, packageHeightCm: null, packageWeightKg: null, install: 15, warranty: 12, maintenanceIntervalMonths: null, stock: 10, active: true, description: "" };

function CategorySelect({ categories, value, onChange }) {
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const options = [{ id: "", name: "Mọi danh mục" }, ...categories];
  const selected = options.find((option) => option.id === value) || options[0];
  useEffect(() => {
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const move = (direction) => {
    const current = Math.max(0, options.findIndex((option) => option.id === value));
    const next = options[(current + direction + options.length) % options.length];
    onChange(next.id);
  };
  return <div className={`category-select ${open ? "is-open" : ""}`} ref={root}>
    <button type="button" className="input category-select-trigger" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((state) => !state)} onKeyDown={(event) => {
      if (["ArrowDown", "ArrowUp"].includes(event.key)) { event.preventDefault(); if (!open) setOpen(true); else move(event.key === "ArrowDown" ? 1 : -1); }
      if (event.key === "Escape") setOpen(false);
    }}><span>{selected.name}</span><span className="category-select-chevron" aria-hidden="true">⌄</span></button>
    {open && <div className="category-select-menu" role="listbox" aria-label="Lọc theo danh mục">
      {options.map((option) => <button type="button" key={option.id || "all"} role="option" aria-selected={value === option.id} className="category-select-option" onClick={() => { onChange(option.id); setOpen(false); }}><span>{option.name}</span>{value === option.id && <span className="category-select-check" aria-hidden="true">✓</span>}</button>)}
    </div>}
  </div>;
}

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
  const [viewing, setViewing] = useState(null);
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [imageFiles, setImageFiles] = useState([]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const list = state.products.filter((p) => (!cat || p.category === cat) && (!q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())));

  useEffect(() => {
    const savedToken = loadToken();
    if (!savedToken) return;
    setToken(savedToken);
    actions.loadProducts(savedToken).then(async (result) => {
      setConnected(result.ok);
      if (!result.ok) {
        setConnectionError(result.error?.message || "Không tải được danh sách quản trị. Kiểm tra quyền tài khoản và backend.");
        if (result.error?.status === 403) {
          try { await actions.refreshSession(); } catch {}
        }
      } else {
        actions.loadOrders(savedToken);
      }
    });
  }, []);

  useEffect(() => {
    const urls = imageFiles.map(file => URL.createObjectURL(file));
    setImagePreviews(urls);
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [imageFiles]);

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
    if (!edit.name.trim() || !edit.brand.trim() || !edit.category || !Number.isFinite(Number(edit.price)) || Number(edit.price) <= 0 || (edit.costPrice !== null && edit.costPrice !== "" && (!Number.isFinite(Number(edit.costPrice)) || Number(edit.costPrice) < 0))) { setFormError("Vui lòng nhập tên, hãng, danh mục, giá bán lớn hơn 0 và giá nhập không âm."); return; }
    if (!connected) return;
    if (imageFiles.some(file => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
      setFormError("Ảnh phải là định dạng hình ảnh và không vượt quá 5 MB.");
      return;
    }
    if ((edit.images || []).length + imageFiles.length > 20) { setFormError("Chỉ được chọn tối đa 20 ảnh."); return; }
    setSaving(true);
    setFormError("");
    try {
      const images = [...(edit.images || []), ...await Promise.all(imageFiles.map(uploadImage))];
      const saved = await actions.saveProduct({ ...edit, images, price: Number(edit.price), costPrice: edit.costPrice === "" || edit.costPrice == null ? null : Number(edit.costPrice), oldPrice: edit.oldPrice ? Number(edit.oldPrice) : null, volume: Number(edit.volume), weight: Number(edit.weight), packageLengthCm: edit.packageLengthCm ? Number(edit.packageLengthCm) : null, packageWidthCm: edit.packageWidthCm ? Number(edit.packageWidthCm) : null, packageHeightCm: edit.packageHeightCm ? Number(edit.packageHeightCm) : null, packageWeightKg: edit.packageWeightKg ? Number(edit.packageWeightKg) : null, install: Number(edit.install), stock: Number(edit.stock), warranty: Number(edit.warranty), maintenanceIntervalMonths: edit.maintenanceIntervalMonths ? Number(edit.maintenanceIntervalMonths) : null });
      if (!saved) { setFormError("Không lưu được sản phẩm. Vui lòng kiểm tra thông báo và thử lại."); return; }
      setEdit(null);
      setImageFiles([]);
    } catch (error) {
      setFormError(error.message || "Không tải ảnh hoặc lưu được sản phẩm. Vui lòng thử lại.");
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
        <CategorySelect categories={categories} value={cat} onChange={setCat} />
        <button className="btn secondary" disabled={!connected} onClick={() => setManagingCategories(true)}>Quản lý danh mục</button>
        <button className="btn" disabled={!connected || !categories.length} onClick={() => { setImageFiles([]); setFormError(""); setEdit({ ...EMPTY, category: categories[0]?.id || "" }); }}>Thêm sản phẩm</button>
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
                    <button type="button" className="ghost" aria-label={`Xem thông tin ${p.name}`} onClick={() => setViewing(p)} style={{ width: 36, height: 36, color: "var(--road)", flex: "none", padding: 0, border: 0, background: "transparent", cursor: "pointer" }}>{p.imageUrl ? <img src={p.imageUrl} alt={p.name} style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6 }} /> : <Art category={p.category} />}</button>
                    <div><button type="button" className="strong ghost" onClick={() => setViewing(p)} style={{ padding: 0, border: 0, background: "transparent", cursor: "pointer", textAlign: "left" }}>{p.name}</button><div className="tiny muted">{p.sku}</div></div>
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
                  <button className="btn ghost sm" disabled={!connected} onClick={() => { setImageFiles([]); setFormError(""); setEdit({ ...p }); }}>Sửa</button>
                  <button className="btn ghost sm" disabled={!connected} onClick={() => actions.toggleProduct(p.id)}>{p.active ? "Ẩn" : "Mở bán"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {viewing && (
        <Modal wide title={viewing.name} onClose={() => setViewing(null)} footer={<button className="btn secondary" onClick={() => setViewing(null)}>Đóng</button>}>
          <div className="row" style={{ alignItems: "flex-start", gap: 24, flexWrap: "wrap" }}>
            <div style={{ width: 220, minHeight: 180, flex: "none", display: "grid", placeItems: "center", border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
              {viewing.imageUrl ? <img src={viewing.imageUrl} alt={viewing.name} style={{ width: "100%", maxHeight: 220, objectFit: "contain" }} /> : <div style={{ width: 120, height: 120, color: "var(--road)" }}><Art category={viewing.category} /></div>}
            </div>
            <div style={{ flex: "1 1 300px" }}>
              <div className="tiny muted">Mã sản phẩm: {viewing.sku || "—"}</div>
              <h3 style={{ margin: "8px 0" }}>{viewing.name}</h3>
              <div className="small muted">{viewing.brand || "Chưa có hãng"} · {categories.find((c) => c.id === viewing.category)?.name || viewing.category || "Chưa phân loại"}</div>
              <div className="row" style={{ marginTop: 14, gap: 18 }}><strong>{vnd(viewing.price)}</strong>{viewing.oldPrice > viewing.price && <span className="strike">{vnd(viewing.oldPrice)}</span>}</div>
              <p style={{ whiteSpace: "pre-wrap" }}>{viewing.description || "Chưa có mô tả sản phẩm."}</p>
              {(viewing.images || []).length > 1 && <div className="row" style={{ flexWrap: "wrap", marginTop: 12 }}>{viewing.images.map((image, index) => <img key={`${image.imageUrl}-${index}`} src={image.imageUrl} alt={`${viewing.name} ${index + 1}`} style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} />)}</div>}
            </div>
          </div>
          <div className="form-grid" style={{ marginTop: 20 }}>
            <div><span className="tiny muted">Giá nhập</span><div>{viewing.costPrice == null ? "—" : vnd(viewing.costPrice)}</div></div>
            <div><span className="tiny muted">Tồn kho</span><div>{viewing.stock ?? 0}</div></div>
            <div><span className="tiny muted">Trạng thái</span><div>{viewing.active ? "Đang bán" : "Đã ẩn"}</div></div>
            <div><span className="tiny muted">Bảo hành</span><div>{viewing.warranty ? `${viewing.warranty} tháng` : "—"}</div></div>
            <div><span className="tiny muted">Thể tích</span><div>{viewing.volume ?? "—"} m³</div></div>
            <div><span className="tiny muted">Lắp đặt</span><div>{viewing.install ? `${viewing.install} phút` : "—"}</div></div>
            <div><span className="tiny muted">Chu kỳ bảo dưỡng</span><div>{viewing.maintenanceIntervalMonths ? `${viewing.maintenanceIntervalMonths} tháng` : "—"}</div></div>
            <div><span className="tiny muted">Kích thước kiện (D × R × C)</span><div>{[viewing.packageLengthCm, viewing.packageWidthCm, viewing.packageHeightCm].some((x) => x != null) ? `${viewing.packageLengthCm ?? "—"} × ${viewing.packageWidthCm ?? "—"} × ${viewing.packageHeightCm ?? "—"} cm` : "—"}</div></div>
            <div><span className="tiny muted">Trọng lượng kiện</span><div>{viewing.packageWeightKg == null ? "—" : `${viewing.packageWeightKg} kg`}</div></div>
          </div>
        </Modal>
      )}

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
        <Modal wide title={edit.id ? "Sửa sản phẩm" : "Thêm sản phẩm"} onClose={() => { if (!saving) setEdit(null); }}
          footer={<>{formError && <div className="notice bad product-form-error" role="alert">{formError}</div>}<button className="btn secondary" disabled={saving} onClick={() => { setEdit(null); setImageFiles([]); }}>Huỷ</button><button className="btn" disabled={saving} onClick={save}>{saving ? "Đang tải ảnh và lưu…" : "Lưu sản phẩm"}</button></>}>
          <div className="form-grid">
            <Field label="Tên sản phẩm" full><input className="input" value={edit.name} onChange={set("name")} /></Field>
            <Field label="Hãng"><input className="input" value={edit.brand} onChange={set("brand")} /></Field>
            <Field label="Danh mục">
              <select className="input" value={edit.category} onChange={set("category")}>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </Field>
            <Field label="Giá nhập (₫)" hint="Để trống nếu chưa biết"><input className="input" type="number" min="0" step="1" value={edit.costPrice ?? ""} onChange={set("costPrice")} /></Field>
            <Field label="Giá bán (₫)"><input className="input" type="number" min="0" step="10000" value={edit.price ?? ""} onChange={set("price")} placeholder="Nhập giá bán" /></Field>
            <Field label="Giá trước giảm (₫)" hint="Để trống nếu không giảm giá"><input className="input" type="number" min="0" step="10000" value={edit.oldPrice ?? ""} onChange={set("oldPrice")} /></Field>
            <Field label="Tồn kho"><input className="input" type="number" min="0" value={edit.stock} onChange={set("stock")} /></Field>
            <Field label="Bảo hành (tháng)"><input className="input" type="number" min="0" value={edit.warranty} onChange={set("warranty")} /></Field>
            <Field label="Chu kỳ bảo dưỡng (tháng)" hint="Để trống nếu chưa có lịch khuyến nghị"><input className="input" type="number" min="1" max="120" value={edit.maintenanceIntervalMonths ?? ""} onChange={set("maintenanceIntervalMonths")} /></Field>
            <Field label="Thể tích sản phẩm (m³)" hint="Dùng điều phối xe; không thay thế thể tích kiện hàng để tính cước"><input className="input" type="number" min="0" step="0.01" value={edit.volume} onChange={set("volume")} /></Field>
            <Field label="Thời gian lắp đặt (phút)" hint="Dùng tính giờ đến các điểm sau"><input className="input" type="number" min="0" value={edit.install} onChange={set("install")} /></Field>
            <div className="field full"><b>Kích thước và trọng lượng kiện hàng thực tế</b><span className="tiny muted">Cần điền để hệ thống báo giá vận chuyển chính xác. Mỗi đơn vị sản phẩm được tính là một kiện riêng.</span></div>
            <Field label="Dài kiện hàng (cm)"><input className="input" type="number" min="0" step="0.1" value={edit.packageLengthCm ?? ""} onChange={set("packageLengthCm")} /></Field>
            <Field label="Rộng kiện hàng (cm)"><input className="input" type="number" min="0" step="0.1" value={edit.packageWidthCm ?? ""} onChange={set("packageWidthCm")} /></Field>
            <Field label="Cao kiện hàng (cm)"><input className="input" type="number" min="0" step="0.1" value={edit.packageHeightCm ?? ""} onChange={set("packageHeightCm")} /></Field>
            <Field label="Trọng lượng kiện hàng (kg)"><input className="input" type="number" min="0" step="0.01" value={edit.packageWeightKg ?? ""} onChange={set("packageWeightKg")} /></Field>
            <Field label="Mô tả" full><textarea className="input" rows={3} value={edit.description} onChange={set("description")} /></Field>
            <Field label="Ảnh sản phẩm" full>
              <div className="stack-sm">
                <label className="product-image-picker">
                  <span className="btn secondary sm">Chọn ảnh</span>
                  <span>{imageFiles.length ? `Đã chọn ${imageFiles.length} ảnh mới` : "Chọn ảnh từ thiết bị"}</span>
                  <input type="file" accept="image/*" multiple disabled={saving} onChange={(event) => {
                    const files = Array.from(event.target.files || []);
                    event.target.value = "";
                    if (files.some((file) => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) { setFormError("Ảnh phải là định dạng hình ảnh và không vượt quá 5 MB."); return; }
                    if ((edit.images || []).length + imageFiles.length + files.length > 20) { setFormError("Chỉ được chọn tối đa 20 ảnh."); return; }
                    setFormError("");
                    setImageFiles((current) => [...current, ...files]);
                  }} />
                </label>
                <span className="tiny muted">Tối đa 20 ảnh, mỗi ảnh 5 MB. Ảnh đầu tiên là ảnh chính; ảnh được tải lên khi lưu sản phẩm.</span>
                <div className="row" style={{ flexWrap: "wrap" }}>
                  {(edit.images || []).map((image, index) => <div key={`${image.imageUrl}-${index}`}><img src={image.imageUrl} alt={`Ảnh ${index + 1}`} style={{ width: 100, height: 80, objectFit: "cover" }} /><button type="button" className="btn ghost sm" onClick={() => setEdit({ ...edit, images: edit.images.filter((_, i) => i !== index) })}>Xóa</button></div>)}
                  {imagePreviews.map((url, index) => <div className="product-image-preview" key={url}><img src={url} alt={`Ảnh mới ${index + 1}`} style={{ width: 100, height: 80, objectFit: "cover" }} /><span className="tiny" title={imageFiles[index]?.name}>{imageFiles[index]?.name}</span><button type="button" className="btn ghost sm" disabled={saving} onClick={() => setImageFiles(files => files.filter((_, i) => i !== index))}>Xóa</button></div>)}
                </div>
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
