"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "@/components/ui";
import { api } from "@/lib/api";
import { addMapTiles } from "@/lib/map-tiles";

const DEFAULT = [16.0678, 108.2208];

export default function LocationPicker({ initial, onClose, onSelect, warehouse = false }) {
  const element = useRef(null), map = useRef(null), marker = useRef(null), sequence = useRef(0), searchSequence = useRef(0), locationSequence = useRef(0), accuracyCircle = useRef(null), leaflet = useRef(null);
  const initialPoint = initial?.lat !== "" && initial?.lng !== "" && initial?.lat != null && initial?.lng != null ? [Number(initial.lat), Number(initial.lng)] : null;
  const [point, setPoint] = useState(initialPoint);
  const [address, setAddress] = useState(initial?.address || "");
  const [district, setDistrict] = useState(initial?.district || "");
  const [query, setQuery] = useState(initial?.address || "");
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [houseNumberMissing, setHouseNumberMissing] = useState(false);

  async function select(lat, lng) {
    const request = ++sequence.current;
    setPoint([lat, lng]); setLoading(true); setError(""); setAddress(""); setDistrict("");
    try {
      const [data] = await api(`/api/location/geocode?${new URLSearchParams({ reverse: "1", lat, lon: lng })}`);
      if (request !== sequence.current) return;
      if (!data?.display_name) throw new Error();
      setAddress(data.display_name.slice(0, 255));
      setDistrict(data.address?.city_district || data.address?.district || data.address?.county || "");
    } catch { if (request === sequence.current) setError("Không tìm được địa chỉ cho điểm này. Bạn có thể nhập địa chỉ sau khi xác nhận."); }
    finally { if (request === sequence.current) setLoading(false); }
  }

  useEffect(() => {
    let active = true, resizeObserver = null;
    import("leaflet").then((module) => {
      if (!active) return;
      const L = module.default || module;
      leaflet.current = L;
      const instance = L.map(element.current).setView(initialPoint || DEFAULT, initialPoint ? 17 : 13);
      map.current = instance;
      addMapTiles(L, instance);
      marker.current = L.marker(initialPoint || DEFAULT, { draggable: true, icon: L.divIcon({ className: "location-pin", html: "<span></span>", iconSize: [30, 40], iconAnchor: [15, 40] }) }).addTo(instance);
      if (!initialPoint) marker.current.setOpacity(0);
      instance.on("click", (e) => { clearAccuracy(); marker.current.setOpacity(1).setLatLng(e.latlng); select(e.latlng.lat, e.latlng.lng); });
      marker.current.on("dragend", () => { clearAccuracy(); const p = marker.current.getLatLng(); select(p.lat, p.lng); });
      if (typeof ResizeObserver !== "undefined" && element.current) {
        resizeObserver = new ResizeObserver(() => instance.invalidateSize());
        resizeObserver.observe(element.current);
      }
      setTimeout(() => instance.invalidateSize(), 100);
      setTimeout(() => instance.invalidateSize(), 350);
    }).catch(() => setError("Không tải được bản đồ. Vui lòng thử lại."));
    return () => { active = false; sequence.current++; searchSequence.current++; locationSequence.current++; resizeObserver?.disconnect(); map.current?.remove(); map.current = null; };
  }, []);

  function clearAccuracy() {
    accuracyCircle.current?.remove(); accuracyCircle.current = null; setAccuracy(null);
  }
  function move(lat, lng) {
    map.current?.setView([lat, lng], 17);
    marker.current?.setOpacity(1).setLatLng([lat, lng]);
    select(lat, lng);
  }
  function chooseResult(result) {
    const lat = Number(result.lat), lng = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    ++sequence.current;
    clearAccuracy();
    map.current?.setView([lat, lng], 17);
    marker.current?.setOpacity(1).setLatLng([lat, lng]);
    setPoint([lat, lng]);
    setAddress(String(result.display_name || "").slice(0, 255));
    setDistrict(result.address?.city_district || result.address?.district || result.address?.county || "");
    setLoading(false); setError(""); setResults([]);
  }
  async function search(e) {
    e.preventDefault(); if (!query.trim()) return;
    const request = ++searchSequence.current;
    const center = map.current?.getCenter() || { lat: DEFAULT[0], lng: DEFAULT[1] };
    setError(""); setResults([]); setHouseNumberMissing(false);
    try {
      const params = new URLSearchParams({ q: query.trim(), lat: center.lat, lon: center.lng });
      const data = await api(`/api/location/geocode?${params}`);
      if (request !== searchSequence.current) return;
      const distance = (item) => {
        const lat = (Number(item.lat) - center.lat) * Math.PI / 180;
        const lng = (Number(item.lon) - center.lng) * Math.PI / 180;
        const a = Math.sin(lat / 2) ** 2 + Math.cos(center.lat * Math.PI / 180) * Math.cos(Number(item.lat) * Math.PI / 180) * Math.sin(lng / 2) ** 2;
        return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
      };
      const number = query.trim().match(/^(\d+[\w/.-]*)\b/)?.[1]?.toLowerCase();
      const exactNumber = (item) => number && String(item.address?.house_number || "").toLowerCase() === number;
      setHouseNumberMissing(Boolean(number && data.length && !data.some(exactNumber)));
      setResults(data.sort((a, b) => Number(Boolean(exactNumber(b))) - Number(Boolean(exactNumber(a))) || distance(a) - distance(b)).slice(0, 5));
      if (!data.length) setError("Không tìm thấy địa chỉ gần khu vực bản đồ. Hãy thử tên đường hoặc kéo bản đồ đến khu vực khác rồi tìm lại.");
    } catch { if (request === searchSequence.current) setError("Không tìm kiếm được địa chỉ. Vui lòng thử lại hoặc chọn trực tiếp trên bản đồ."); }
  }
  async function useApproximateLocation(request, locationError) {
    try {
      const res = await fetch('/api/location/approximate', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (request !== locationSequence.current || !Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return;
      map.current?.setView([data.lat, data.lng], 13);
      setError(`Không lấy được GPS. Bản đồ đã chuyển đến khu vực ${data.city || 'gần bạn'} theo mạng; hãy chạm vào đúng vị trí giao hàng.`);
    } catch {
      if (request !== locationSequence.current) return;
      if (locationError.code === 1) {
        setError("Chrome chưa được hệ điều hành cho phép định vị. Hãy bật Dịch vụ định vị cho Google Chrome trong Cài đặt hệ thống, rồi thử lại.");
      } else if (locationError.code === 3) {
        setError("Định vị mất quá nhiều thời gian. Hãy kiểm tra Wi-Fi/Dịch vụ định vị rồi thử lại hoặc chọn trực tiếp trên bản đồ.");
      } else {
        setError("Thiết bị chưa xác định được vị trí. Hãy bật Wi-Fi và Dịch vụ định vị, rồi thử lại hoặc chọn trực tiếp trên bản đồ.");
      }
    } finally {
      if (request === locationSequence.current) setLocating(false);
    }
  }
  function locate() {
    if (!navigator.geolocation) return setError("Trình duyệt không hỗ trợ định vị.");
    const request = ++locationSequence.current;
    setLocating(true); setError("");
    const onSuccess = (p) => {
      if (request !== locationSequence.current) return;
      setLocating(false); clearAccuracy();
      const { latitude, longitude, accuracy: meters } = p.coords;
      move(latitude, longitude);
      if (Number.isFinite(meters) && leaflet.current && map.current) {
        setAccuracy(Math.ceil(meters));
        accuracyCircle.current = leaflet.current.circle([latitude, longitude], { radius: meters, color: "#1b4f8c", weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map.current);
      }
    };
    navigator.geolocation.getCurrentPosition(onSuccess, (locationError) => {
      if (request !== locationSequence.current) return;
      if (locationError.code !== 2) return void useApproximateLocation(request, locationError);
      setError("Thiết bị chưa trả về vị trí mạng. Đang thử GPS chính xác…");
      navigator.geolocation.getCurrentPosition(onSuccess, (preciseError) => {
        if (request === locationSequence.current) void useApproximateLocation(request, preciseError);
      }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
    }, { enableHighAccuracy: false, maximumAge: 300000, timeout: 10000 });
  }
  return <Modal wide title={warehouse ? "Chọn vị trí kho" : "Chọn vị trí giao hàng"} onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Huỷ</button><button className="btn" disabled={!point || loading} onClick={() => onSelect({ lat: point[0], lng: point[1], address, district })}>Xác nhận vị trí</button></>}>
    <div className="stack-sm">
      <form className="row map-search" onSubmit={search}><input className="input grow" aria-label="Tìm địa chỉ" placeholder="Tìm số nhà, đường hoặc địa điểm" value={query} onChange={(e) => setQuery(e.target.value)} /><button className="btn secondary" type="submit">Tìm</button><button className="btn secondary" type="button" disabled={locating} onClick={locate}>{locating ? "Đang định vị…" : "Vị trí của tôi"}</button></form>
      {results.length > 0 && <><p className="tiny muted">{houseNumberMissing ? "Không tìm thấy chính xác số nhà trong dữ liệu bản đồ. Các kết quả dưới đây là vị trí tham khảo; hãy ghim và nhập lại số nhà." : "Kết quả gần khu vực bản đồ. Kiểm tra địa chỉ và vị trí trước khi chọn."}</p><div className="map-results">{results.map((result) => <button type="button" key={result.place_id} onClick={() => chooseResult(result)}>{result.display_name}</button>)}</div></>}
      <p className="small muted">Tìm kiếm ưu tiên khu vực giữa bản đồ. Nhấn vào bản đồ hoặc kéo ghim đến đúng vị trí cần chọn.</p>
      <div className="map-box"><div ref={element} className="location-map" aria-label="Bản đồ chọn vị trí" /></div>
      {error && <div className="notice warn">{error}</div>}
      {accuracy != null && <p className="small muted" aria-live="polite">Vị trí thiết bị có sai số ước tính khoảng {accuracy} m (vòng tròn xanh). Hãy kéo ghim đến đúng vị trí.</p>}
      <div className="small" aria-live="polite">{loading ? "Đang tìm địa chỉ gần ghim…" : !point ? "Chưa chọn vị trí." : "Địa chỉ gần ghim chỉ mang tính tham khảo; hãy sửa đúng số nhà trước khi xác nhận."}</div>
      {point && <label className="field"><span>{warehouse ? "Địa chỉ kho" : "Địa chỉ nhận hàng"}</span><input className="input" maxLength={255} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Nhập số nhà và địa chỉ chính xác" /></label>}
      <p className="tiny muted">Địa chỉ được tra cứu bởi <a href="https://www.geoapify.com/" target="_blank" rel="noreferrer">Geoapify</a> và có thể chưa đầy đủ số nhà; vui lòng kiểm tra và bổ sung sau khi chọn.</p>
    </div>
  </Modal>;
}
