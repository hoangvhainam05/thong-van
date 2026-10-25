"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { CATEGORIES } from "@/lib/mock/catalog";
import { vnd } from "@/lib/format";
import { api, loadToken, saveToken } from "@/lib/api";
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
  const [token, setToken] = useState("");
  const [tokenDraft, setTokenDraft] = useState("");
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
      if (!ok) setConnectionError("Không tải được danh sách quản trị. Kiểm tra staff token và backend.");
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

  const connect = async () => {
    const value = tokenDraft.trim();
    if (!value) return;
    saveToken(value);
    setToken(value);
    const ok = await actions.loadProducts(value);
    setConnected(ok);
    setConnectionError(ok ? "" : "Không xác thực được. Kiểm tra staff token cấu hình trong backend/.env.");
    if (ok) await actions.loadOrders(value);
  };

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
    return result.secure_url;
  };

  const save = async () => {
    if (!edit.name || !edit.brand || edit.price <= 0) return;
    if (!connected) return;
    if (imageFile && (!imageFile.type.startsWith("image/") || imageFile.size > 5 * 1024 * 1024)) {
      setConnectionError("Ảnh phải là định dạng hình ảnh và nhỏ hơn 5 MB.");
      return;
    }
    setSaving(true);
    setConnectionError("");
    try {
      const imageUrl = imageFile ? await uploadImage(imageFile) : edit.imageUrl;
      const saved = await actions.saveProduct({ ...edit, imageUrl, price: Number(edit.price), oldPrice: edit.oldPrice ? Number(edit.oldPrice) : null, volume: Number(edit.volume), weight: Number(edit.weight), install: Number(edit.install), stock: Number(edit.stock), warranty: Number(edit.warranty) });
      if (!saved) return;
      setEdit(null);
      setImageFile(null);
    } catch (error) {
      setConnectionError(error.message || "Không lưu được sản phẩm.");
    } finally {
      setSaving(false);
    }
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
        <button className="btn" disabled={!connected} onClick={() => { setImageFile(null); setEdit({ ...EMPTY }); }}>Thêm sản phẩm</button>
      </PageHead>
      {!connected && <div className="panel panel-pad stack-sm" style={{ marginBottom: 14 }}>
        <b>Kết nối dữ liệu sản phẩm</b>
        <p className="small muted">Nhập staff token đã cấu hình ở backend/.env để tải và chỉnh sửa dữ liệu MySQL.</p>
        <div className="row"><input className="input" type="password" autoComplete="current-password" value={tokenDraft} onChange={(e) => setTokenDraft(e.target.value)} placeholder="Staff token" /><button className="btn" onClick={connect}>Kết nối</button></div>
      </div>}
      {connectionError && <div className="notice bad" style={{ marginBottom: 14 }}>{connectionError}</div>}
      <div className="panel table-wrap">
        <table className="table">
          <thead><tr><th>Sản phẩm</th><th>Danh mục</th><th className="num">Giá bán</th><th className="num">Tồn kho</th><th className="num">Thể tích</th><th className="num">Lắp đặt</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
                <td>
                  <div className="row" style={{ flexWrap: "nowrap" }}>
                    <span style={{ width: 36, height: 36, color: "var(--road)", flex: "none" }}>{p.imageUrl ? <img src={p.imageUrl} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6 }} /> : <Art category={p.category} />}</span>
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
                  <button className="btn ghost sm" disabled={!connected} onClick={() => { setImageFile(null); setEdit({ ...p }); }}>Sửa</button>
                  <button className="btn ghost sm" disabled={!connected} onClick={() => actions.toggleProduct(p.id)}>{p.active ? "Ẩn" : "Mở bán"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {edit && (
        <Modal wide title={edit.id ? "Sửa sản phẩm" : "Thêm sản phẩm"} onClose={() => setEdit(null)}
          footer={<><button className="btn secondary" onClick={() => { setEdit(null); setImageFile(null); }}>Huỷ</button><button className="btn" disabled={saving} onClick={save}>{saving ? "Đang lưu…" : "Lưu sản phẩm"}</button></>}>
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
