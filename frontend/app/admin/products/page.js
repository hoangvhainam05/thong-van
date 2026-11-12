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
import { RotateCcw, RotateCw } from "lucide-react";
import { createProductWorkbook, readProductWorkbook } from "@/lib/product-excel";

const EMPTY = { name: "", brand: "", category: "", costPrice: null, price: "", oldPrice: null, volume: 0.3, weight: 20, packageLengthCm: null, packageWidthCm: null, packageHeightCm: null, packageWeightKg: null, install: 15, warranty: 12, maintenanceIntervalMonths: null, stock: 10, active: true, description: "" };

const IMPORT_COLUMNS = [
  ["Tên sản phẩm", "name"], ["Hãng", "brand"], ["Danh mục", "category"],
  ["Giá nhập (₫)", "costPrice"], ["Giá bán (₫)", "price"], ["Giá trước giảm (₫)", "oldPrice"],
  ["Tồn kho", "stock"], ["Bảo hành (tháng)", "warranty"], ["Chu kỳ bảo dưỡng (tháng)", "maintenanceIntervalMonths"],
  ["Thể tích sản phẩm (m³)", "volume"], ["Trọng lượng sản phẩm (kg)", "weight"], ["Thời gian lắp đặt (phút)", "install"],
  ["Dài kiện hàng (cm)", "packageLengthCm"], ["Rộng kiện hàng (cm)", "packageWidthCm"], ["Cao kiện hàng (cm)", "packageHeightCm"],
  ["Trọng lượng kiện hàng (kg)", "packageWeightKg"], ["Mô tả", "description"],
];
const IMPORT_DEFAULTS = { costPrice: null, oldPrice: null, stock: 10, warranty: 12, maintenanceIntervalMonths: null, volume: 0.3, weight: 20, install: 15, packageLengthCm: null, packageWidthCm: null, packageHeightCm: null, packageWeightKg: null, description: "" };
const OPTIONAL_NUMBERS = new Set(["costPrice", "oldPrice", "maintenanceIntervalMonths", "packageLengthCm", "packageWidthCm", "packageHeightCm", "packageWeightKg"]);
const INTEGER_NUMBERS = new Set(["stock", "warranty", "maintenanceIntervalMonths", "install"]);

function cellText(value) { return value == null ? "" : String(value).trim(); }
function importNumber(value) {
  if (typeof value === "number") return value;
  const normalized = cellText(value).replace(/\s/g, "").replace(/,(?=\d{1,2}$)/, ".");
  return normalized ? Number(normalized) : null;
}
function parseProductRows(rows, categories) {
  const headers = rows[0].map((value) => cellText(value).toLowerCase());
  const categoryFor = (value) => {
    const key = cellText(value).toLowerCase();
    return categories.find((category) => category.id.toLowerCase() === key || category.name.trim().toLowerCase() === key);
  };
  return rows.slice(1).map((cells, index) => {
    const source = Object.fromEntries(IMPORT_COLUMNS.map(([label, key]) => {
      const columnIndex = headers.indexOf(label.toLowerCase());
      return [key, columnIndex < 0 ? "" : cells[columnIndex]];
    }));
    if (Object.values(source).every((value) => !cellText(value))) return null;
    const rowNumber = index + 2;
    const product = { ...IMPORT_DEFAULTS };
    product.name = cellText(source.name);
    product.brand = cellText(source.brand);
    const category = categoryFor(source.category);
    product.category = category?.id || "";
    product.price = importNumber(source.price);
    product.costPrice = importNumber(source.costPrice);
    product.oldPrice = importNumber(source.oldPrice);
    product.volume = importNumber(source.volume) ?? IMPORT_DEFAULTS.volume;
    product.weight = importNumber(source.weight) ?? IMPORT_DEFAULTS.weight;
    product.install = importNumber(source.install) ?? IMPORT_DEFAULTS.install;
    product.stock = importNumber(source.stock) ?? IMPORT_DEFAULTS.stock;
    product.warranty = importNumber(source.warranty) ?? IMPORT_DEFAULTS.warranty;
    product.maintenanceIntervalMonths = importNumber(source.maintenanceIntervalMonths);
    product.packageLengthCm = importNumber(source.packageLengthCm);
    product.packageWidthCm = importNumber(source.packageWidthCm);
    product.packageHeightCm = importNumber(source.packageHeightCm);
    product.packageWeightKg = importNumber(source.packageWeightKg);
    product.description = cellText(source.description);
    const errors = [];
    if (!product.name || product.name.length < 2) errors.push("Tên sản phẩm cần ít nhất 2 ký tự");
    if (!product.brand) errors.push("Thiếu hãng");
    if (!cellText(source.category)) errors.push("Thiếu danh mục");
    else if (!category) errors.push("Danh mục không khớp tên hoặc mã danh mục");
    if (product.price == null || !Number.isFinite(product.price) || product.price <= 0) errors.push("Giá bán phải lớn hơn 0");
    for (const [, key] of IMPORT_COLUMNS) {
      const value = product[key];
      if (typeof value === "number" && value != null && (!Number.isFinite(value) || value < 0 || (INTEGER_NUMBERS.has(key) && !Number.isInteger(value)))) errors.push(`${key} phải là số ${INTEGER_NUMBERS.has(key) ? "nguyên " : ""}không âm`);
      if (OPTIONAL_NUMBERS.has(key) && cellText(source[key]) && value == null) errors.push(`${key} không phải số hợp lệ`);
    }
    if (!Number.isFinite(product.volume) || product.volume > 999.999) errors.push("Thể tích phải từ 0 đến 999,999 m³");
    return { rowNumber, product, errors };
  }).filter(Boolean);
}

function downloadProductTemplate(categories) {
  const headers = IMPORT_COLUMNS.map(([label]) => label);
  const sample = ["Máy nước nóng mẫu", "Thương hiệu mẫu", categories[0]?.name || "Tên danh mục", 1600000, 2500000, 2900000, 10, 12, 6, 0.3, 20, 15, 45, 35, 80, 18.5, "Máy nước nóng dung tích 20 lít, bảo hành chính hãng."];
  const guide = [
    ["Hướng dẫn nhập sản phẩm"],
    ["1. Nhập dữ liệu từ dòng 2 trong sheet Sản phẩm; không đổi tên hàng tiêu đề. Dòng 2 là ví dụ đầy đủ, hãy thay bằng thông tin thật."],
    ["2. Bắt buộc: Tên sản phẩm (tối thiểu 2 ký tự), Hãng, Danh mục, Giá bán (> 0)."],
    ["3. Danh mục nhập đúng tên hoặc mã danh mục đang có trong hệ thống."],
    ["4. Mẫu có đủ các trường sản phẩm. Thay nội dung ví dụ bằng dữ liệu cần nhập; các trường tùy chọn có thể để trống nếu chưa có."],
    ["5. Mã sản phẩm (SKU) do hệ thống tự tạo sau khi lưu, không cần nhập trong file."],
    ["6. Không có cột ảnh vì không bắt buộc; có thể thêm ảnh sau trong form sửa sản phẩm."],
    ["7. Các cột số phải là số không âm; tồn kho, bảo hành, chu kỳ bảo dưỡng và thời gian lắp đặt là số nguyên."],
    ["Danh mục hiện có", ...categories.map((category) => `${category.name} (${category.id})`)],
  ];
  const bytes = createProductWorkbook([{ name: "Sản phẩm", rows: [headers, sample] }, { name: "Hướng dẫn", rows: guide }]);
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url; link.download = "mau-nhap-san-pham.xlsx"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const CROP_SIZE = 512;
function cropGeometry(image, rotation, zoom, size = CROP_SIZE) {
  const quarterTurn = Math.abs(rotation % 180) === 90;
  const rotatedWidth = quarterTurn ? image.naturalHeight : image.naturalWidth;
  const rotatedHeight = quarterTurn ? image.naturalWidth : image.naturalHeight;
  const scale = Math.max(size / rotatedWidth, size / rotatedHeight) * zoom;
  return {
    scale,
    maxX: Math.max(0, (rotatedWidth * scale - size) / 2),
    maxY: Math.max(0, (rotatedHeight * scale - size) / 2),
  };
}

function drawSquareCrop(canvas, image, rotation, zoom, offset) {
  const size = canvas.width;
  const { scale, maxX, maxY } = cropGeometry(image, rotation, zoom, size);
  const x = Math.max(-maxX, Math.min(maxX, offset.x));
  const y = Math.max(-maxY, Math.min(maxY, offset.y));
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, size, size);
  context.fillStyle = "#fff";
  context.fillRect(0, 0, size, size);
  context.save();
  context.translate(size / 2 + x, size / 2 + y);
  context.rotate(rotation * Math.PI / 180);
  context.scale(scale, scale);
  context.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2);
  context.restore();
}

function ProductImageCropModal({ source, onCancel, onSave }) {
  const [image, setImage] = useState(null);
  const [rotation, setRotation] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState("");
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    const remoteSource = typeof source === "string";
    const url = remoteSource ? source : URL.createObjectURL(source);
    const loadedImage = new Image();
    loadedImage.onload = () => { setImage(loadedImage); setError(""); };
    loadedImage.onerror = () => setError("Không đọc được ảnh này. Hãy chọn ảnh từ thiết bị để thay thế.");
    if (remoteSource) loadedImage.crossOrigin = "anonymous";
    loadedImage.src = url;
    return () => { if (!remoteSource) URL.revokeObjectURL(url); };
  }, [source]);

  useEffect(() => {
    if (image && canvasRef.current) drawSquareCrop(canvasRef.current, image, rotation, zoom, offset);
  }, [image, rotation, zoom, offset]);

  const rotate = (direction) => {
    setRotation((value) => (value + direction + 360) % 360);
    setOffset({ x: 0, y: 0 });
  };
  const nudgeCrop = (dx, dy) => {
    if (!image) return;
    const { maxX, maxY } = cropGeometry(image, rotation, zoom);
    setOffset((current) => ({ x: Math.max(-maxX, Math.min(maxX, current.x + dx)), y: Math.max(-maxY, Math.min(maxY, current.y + dy)) }));
  };
  const startDrag = (event) => {
    if (!image) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY };
  };
  const moveDrag = (event) => {
    if (!dragRef.current || !image) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = CROP_SIZE / bounds.width;
    const dx = (event.clientX - dragRef.current.x) * ratio;
    const dy = (event.clientY - dragRef.current.y) * ratio;
    dragRef.current = { x: event.clientX, y: event.clientY };
    const { maxX, maxY } = cropGeometry(image, rotation, zoom);
    setOffset((current) => ({
      x: Math.max(-maxX, Math.min(maxX, current.x + dx)),
      y: Math.max(-maxY, Math.min(maxY, current.y + dy)),
    }));
  };
  const saveCrop = () => {
    if (!image || !canvasRef.current) return;
    try {
      const output = document.createElement("canvas");
      output.width = 1024;
      output.height = 1024;
      drawSquareCrop(output, image, rotation, zoom, { x: offset.x * 2, y: offset.y * 2 });
      output.toBlob((blob) => {
        if (!blob) { setError("Không thể xử lý ảnh này. Hãy thử chọn ảnh khác."); return; }
        const sourceName = typeof source === "string" ? "anh-san-pham" : source.name.replace(/\.[^.]+$/, "");
        const name = `${sourceName}-4x4.jpg`;
        onSave(new File([blob], name, { type: "image/jpeg", lastModified: Date.now() }));
      }, "image/jpeg", 0.9);
    } catch {
      setError("Ảnh hiện tại không cho phép chỉnh sửa trực tiếp. Hãy dùng nút “Thay ảnh” để chọn ảnh từ thiết bị.");
    }
  };

  return <Modal title="Chỉnh sửa ảnh sản phẩm" onClose={onCancel} footer={<>
    <button type="button" className="btn secondary" onClick={onCancel}>Huỷ</button>
    <button type="button" className="btn" disabled={!image} onClick={saveCrop}>Lưu chỉnh sửa</button>
  </>}>
    <div className="product-crop-editor">
      <p className="small muted">Ảnh sẽ được cắt thành hình vuông tỷ lệ 4:4. Kéo ảnh để chọn vùng, phóng to hoặc xoay trước khi tải lên.</p>
      <div className={`product-crop-stage${image ? " is-ready" : ""}`} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={() => { dragRef.current = null; }} onPointerCancel={() => { dragRef.current = null; }}>
        {image ? <canvas ref={canvasRef} width={CROP_SIZE} height={CROP_SIZE} tabIndex={0} aria-label="Vùng cắt ảnh. Kéo ảnh hoặc dùng phím mũi tên để chỉnh vị trí." onKeyDown={(event) => {
          const movements = { ArrowUp: [0, -20], ArrowDown: [0, 20], ArrowLeft: [-20, 0], ArrowRight: [20, 0] };
          const movement = movements[event.key];
          if (movement) { event.preventDefault(); nudgeCrop(...movement); }
        }} /> : <span>{error || "Đang mở ảnh…"}</span>}
      </div>
      {error && image && <div className="notice bad" role="alert">{error}</div>}
      {image && <>
        <div className="product-crop-tools">
          <button type="button" className="btn secondary" aria-label="Xoay trái 90 độ" onClick={() => rotate(-90)}><RotateCcw size={18} /> Xoay trái</button>
          <button type="button" className="btn secondary" aria-label="Xoay phải 90 độ" onClick={() => rotate(90)}><RotateCw size={18} /> Xoay phải</button>
        </div>
        <label className="product-crop-zoom">Phóng to / thu nhỏ
          <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        </label>
        <div className="tiny muted">{typeof source === "string" ? "Ảnh hiện tại" : source.name} · {image.naturalWidth} × {image.naturalHeight} px</div>
      </>}
    </div>
  </Modal>;
}

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
  const [cropQueue, setCropQueue] = useState([]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [importRows, setImportRows] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importTotal, setImportTotal] = useState(0);
  const [importError, setImportError] = useState("");
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
    const urls = imageFiles.map(({ file }) => URL.createObjectURL(file));
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
    if (imageFiles.some(({ file }) => !file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
      setFormError("Ảnh phải là định dạng hình ảnh và không vượt quá 5 MB.");
      return;
    }
    const newImageCount = imageFiles.filter((item) => item.replaceImageIndex == null).length;
    if ((edit.images || []).length + newImageCount > 20) { setFormError("Chỉ được chọn tối đa 20 ảnh."); return; }
    setSaving(true);
    setFormError("");
    try {
      const images = [...(edit.images || [])];
      const uploaded = await Promise.all(imageFiles.map((item) => uploadImage(item.file)));
      imageFiles.forEach((item, index) => {
        if (item.replaceImageIndex == null) images.push(uploaded[index]);
        else images[item.replaceImageIndex] = uploaded[index];
      });
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
  const acceptCroppedImage = (file) => {
    const currentCrop = cropQueue[0];
    if (currentCrop?.replacePendingIndex != null) {
      setImageFiles((current) => current.map((item, index) => index === currentCrop.replacePendingIndex ? { ...item, file } : item));
    } else {
      setImageFiles((current) => [...current, { file, replaceImageIndex: currentCrop?.replaceImageIndex ?? null }]);
    }
    setCropQueue((current) => current.slice(1));
  };
  const removeExistingImage = (imageIndex) => {
    setEdit((current) => ({ ...current, images: current.images.filter((_, index) => index !== imageIndex) }));
    setImageFiles((current) => current.filter((item) => item.replaceImageIndex !== imageIndex).map((item) => item.replaceImageIndex > imageIndex ? { ...item, replaceImageIndex: item.replaceImageIndex - 1 } : item));
  };
  const editPendingImage = (imageIndex) => {
    const item = imageFiles[imageIndex];
    if (item) setCropQueue([{ source: item.file, replacePendingIndex: imageIndex }]);
  };
  const readImportFile = async (file) => {
    setImportError("");
    try {
      const rows = await readProductWorkbook(await file.arrayBuffer());
      if (rows.length < 2) throw new Error("File Excel chưa có dữ liệu sản phẩm.");
      const parsed = parseProductRows(rows, categories);
      if (!parsed.length) throw new Error("Không tìm thấy dòng sản phẩm nào trong file.");
      if (parsed.length > 500) throw new Error("Mỗi lần nhập tối đa 500 sản phẩm.");
      setImportRows(parsed.map((row) => ({ ...row, status: row.errors.length ? "error" : "ready" })));
    } catch (error) {
      setImportError(error.message || "Không đọc được file. Vui lòng dùng file .xlsx theo mẫu.");
      setImportRows(null);
    }
  };
  const importProducts = async () => {
    if (!token || importing || !importRows) return;
    const valid = importRows.filter((row) => row.status === "ready");
    if (!valid.length) return;
    setImporting(true);
    setImportProgress(0);
    setImportTotal(valid.length);
    let completeRows = [...importRows];
    try {
      for (let index = 0; index < valid.length; index++) {
        const row = valid[index];
        try {
          await api("/api/products/admin", { method: "POST", body: row.product, token });
          completeRows = completeRows.map((item) => item.rowNumber === row.rowNumber ? { ...item, status: "success", errors: [] } : item);
        } catch (error) {
          completeRows = completeRows.map((item) => item.rowNumber === row.rowNumber ? { ...item, status: "error", errors: [error.message || "Không tạo được sản phẩm"] } : item);
        }
        setImportRows(completeRows);
        setImportProgress(index + 1);
      }
      await actions.loadProducts(token);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <PageHead title="Sản phẩm" sub="Thể tích và thời gian lắp đặt được dùng để tính sức chứa xe và giờ giao.">
        <input className="input" style={{ width: 220 }} placeholder="Tìm tên hoặc mã" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm sản phẩm" />
        <CategorySelect categories={categories} value={cat} onChange={setCat} />
        <button className="btn secondary" disabled={!connected} onClick={() => setManagingCategories(true)}>Quản lý danh mục</button>
        <button className="btn" disabled={!connected || !categories.length} onClick={() => { setImageFiles([]); setCropQueue([]); setFormError(""); setEdit({ ...EMPTY, category: categories[0]?.id || "" }); }}>Thêm sản phẩm</button>
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
                  <button className="btn ghost sm" disabled={!connected} onClick={() => { setImageFiles([]); setCropQueue([]); setFormError(""); setEdit({ ...p }); }}>Sửa</button>
                  <button className="btn ghost sm" disabled={!connected} onClick={() => actions.toggleProduct(p.id)}>{p.active ? "Ẩn" : "Mở bán"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {importRows && <Modal wide title="Nhập sản phẩm từ Excel" onClose={() => { if (!importing) { setImportRows(null); setImportError(""); } }} footer={<>
        <span className="tiny muted" style={{ marginRight: "auto" }}>{importing ? `Đang nhập ${importProgress}/${importTotal}…` : `${importRows.filter((row) => row.status === "ready").length} dòng hợp lệ · ${importRows.filter((row) => row.status === "error").length} dòng cần sửa · ${importRows.filter((row) => row.status === "success").length} đã nhập`}</span>
        <button className="btn secondary" disabled={importing} onClick={() => { setImportRows(null); setImportError(""); }}>Đóng</button>
        <button className="btn" disabled={importing || !importRows.some((row) => row.status === "ready")} onClick={importProducts}>{importing ? "Đang nhập…" : "Nhập các dòng hợp lệ"}</button>
      </>}>
        {importError && <div className="notice bad" role="alert">{importError}</div>}
        <p className="small muted">SKU do hệ thống tự tạo. Ảnh không nằm trong file Excel và có thể bổ sung sau. Danh mục nhập theo tên hoặc mã; chỉ dòng hợp lệ được gửi.</p>
        <div className="table-wrap" style={{ maxHeight: "55vh", overflow: "auto" }}><table className="table"><thead><tr><th>Dòng</th><th>Tên sản phẩm</th><th>Danh mục</th><th className="num">Giá bán</th><th>Trạng thái</th></tr></thead>
          <tbody>{importRows.map((row) => <tr key={row.rowNumber}>
            <td>{row.rowNumber}</td><td>{row.product.name || "—"}</td>
            <td>{categories.find((category) => category.id === row.product.category)?.name || "—"}</td><td className="num">{Number.isFinite(row.product.price) ? vnd(row.product.price) : "—"}</td>
            <td>{row.status === "success" ? <span className="badge ok">Đã nhập</span> : row.errors.length ? <span className="small" style={{ color: "var(--stop)" }}>{row.errors.join("; ")}</span> : <span className="badge">Sẵn sàng</span>}</td>
          </tr>)}</tbody></table></div>
      </Modal>}

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
          footer={<>
            {formError && <div className="notice bad product-form-error" role="alert">{formError}</div>}
            <div className="product-form-footer">
              {!edit.id && <div className="product-excel-actions">
                <button type="button" className="btn secondary" disabled={saving} onClick={() => downloadProductTemplate(categories)}>Tải file Excel mẫu</button>
                <label className={`btn secondary${!connected || importing ? " disabled" : ""}`} aria-disabled={!connected || importing}>
                  Nhập từ Excel
                  <input type="file" accept=".xlsx" disabled={!connected || importing} style={{ display: "none" }} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) readImportFile(file); }} />
                </label>
              </div>}
              <div className="row product-form-actions">
                <button className="btn secondary" disabled={saving} onClick={() => { setEdit(null); setImageFiles([]); setCropQueue([]); }}>Huỷ</button>
                <button className="btn" disabled={saving} onClick={save}>{saving ? "Đang tải ảnh và lưu…" : "Lưu sản phẩm"}</button>
              </div>
            </div>
          </>}>
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
                    const queuedNewImages = cropQueue.filter((item) => item.replaceImageIndex == null).length;
                    const pendingNewImages = imageFiles.filter((item) => item.replaceImageIndex == null).length;
                    if ((edit.images || []).length + pendingNewImages + queuedNewImages + files.length > 20) { setFormError("Chỉ được chọn tối đa 20 ảnh."); return; }
                    setFormError("");
                    setCropQueue(files.map((file) => ({ source: file, replaceImageIndex: null })));
                  }} />
                </label>
                <span className="tiny muted">Tối đa 20 ảnh, mỗi ảnh 5 MB. Chọn ảnh mới để cắt vuông, hoặc chỉnh / thay ảnh hiện có. Ảnh chỉ tải lên khi lưu sản phẩm.</span>
                <div className="row" style={{ flexWrap: "wrap" }}>
                  {(edit.images || []).map((image, index) => {
                    const replacementIndex = imageFiles.findIndex((item) => item.replaceImageIndex === index);
                    const previewUrl = replacementIndex < 0 ? image.imageUrl : imagePreviews[replacementIndex];
                    return <div className="product-image-preview" key={`${image.imageUrl}-${index}`}>
                      <button type="button" className="product-image-edit-trigger" aria-label={`Chỉnh sửa ảnh ${index + 1}`} title="Nhấn để chỉnh sửa ảnh" disabled={saving} onClick={() => replacementIndex >= 0 ? editPendingImage(replacementIndex) : setCropQueue([{ source: image.imageUrl, replaceImageIndex: index }])}>
                        <img src={previewUrl} alt={`Ảnh ${index + 1}`} style={{ width: 100, height: 80, objectFit: "cover" }} />
                      </button>
                      {replacementIndex >= 0 && <span className="tiny muted">Đã chỉnh, chờ lưu</span>}
                      <label className="btn ghost sm">Thay ảnh
                        <input type="file" accept="image/*" disabled={saving} style={{ display: "none" }} onChange={(event) => {
                          const file = event.target.files?.[0]; event.target.value = "";
                          if (!file) return;
                          if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { setFormError("Ảnh phải là định dạng hình ảnh và không vượt quá 5 MB."); return; }
                          setFormError(""); setCropQueue([{ source: file, replaceImageIndex: index }]);
                        }} />
                      </label>
                      <button type="button" className="btn ghost sm" disabled={saving} onClick={() => removeExistingImage(index)}>Xóa</button>
                    </div>;
                  })}
                  {imageFiles.map((item, index) => item.replaceImageIndex == null && <div className="product-image-preview" key={imagePreviews[index]}>
                    <button type="button" className="product-image-edit-trigger" aria-label={`Chỉnh sửa ảnh mới ${index + 1}`} title="Nhấn để chỉnh sửa ảnh" disabled={saving} onClick={() => editPendingImage(index)}>
                      <img src={imagePreviews[index]} alt={`Ảnh mới ${index + 1}`} style={{ width: 100, height: 80, objectFit: "cover" }} />
                    </button>
                    <span className="tiny" title={item.file.name}>{item.file.name}</span>
                    <button type="button" className="btn ghost sm" disabled={saving} onClick={() => setImageFiles((current) => current.filter((_, itemIndex) => itemIndex !== index))}>Xóa</button>
                  </div>)}
                </div>
              </div>
            </Field>
          </div>
        </Modal>
      )}
      {cropQueue.length > 0 && <ProductImageCropModal
        key={typeof cropQueue[0].source === "string" ? cropQueue[0].source : `${cropQueue[0].source.name}-${cropQueue[0].source.lastModified}-${cropQueue[0].source.size}`}
        source={cropQueue[0].source}
        onCancel={() => setCropQueue([])}
        onSave={acceptCroppedImage}
      />}
    </>
  );
}

export default function ProductsAdmin() {
  return <RequirePerm perm="product.manage"><Products /></RequirePerm>;
}
