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
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [houseNumberMissing, setHouseNumberMissing] = useState(false);
  const queryTimeout = useRef(null);

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

      if (!initialPoint && initial?.address?.trim()) {
        api(`/api/location/geocode?${new URLSearchParams({ q: initial.address.trim(), lat: DEFAULT[0], lon: DEFAULT[1] })}`)
          .then((data) => {
            if (!active || !instance || !Array.isArray(data) || !data.length) return;
            const top = data[0];
            const lat = Number(top.lat), lng = Number(top.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
            instance.setView([lat, lng], 17);
            marker.current?.setOpacity(1).setLatLng([lat, lng]);
            setPoint([lat, lng]);
            setDistrict(top.address?.city_district || top.address?.district || top.address?.county || "");
          })
          .catch(() => {});
      }
    }).catch(() => setError("Không tải được bản đồ. Vui lòng thử lại."));
    return () => { active = false; sequence.current++; searchSequence.current++; locationSequence.current++; clearTimeout(queryTimeout.current); resizeObserver?.disconnect(); map.current?.remove(); map.current = null; };
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

  const onQueryChange = (val) => {
    setQuery(val);
    setError("");
    clearTimeout(queryTimeout.current);
    if (!val.trim() || val.trim().length < 3) {
      setResults([]);
      return;
    }
    queryTimeout.current = setTimeout(async () => {
      const request = ++searchSequence.current;
      const center = map.current?.getCenter() || { lat: DEFAULT[0], lng: DEFAULT[1] };
      setSearching(true);
      try {
        const params = new URLSearchParams({ q: val.trim(), lat: center.lat, lon: center.lng });
        const data = await api(`/api/location/geocode?${params}`);
        if (request !== searchSequence.current) return;
        if (Array.isArray(data)) {
          setResults(data.slice(0, 5));
        }
      } catch {
        if (request === searchSequence.current) setResults([]);
      } finally {
        if (request === searchSequence.current) setSearching(false);
      }
    }, 350);
  };

  async function search(e) {
    e.preventDefault();
    clearTimeout(queryTimeout.current);
    if (!query.trim()) return;
    const request = ++searchSequence.current;
    const center = map.current?.getCenter() || { lat: DEFAULT[0], lng: DEFAULT[1] };
    setError(""); setSearching(true);
    try {
      const params = new URLSearchParams({ q: query.trim(), lat: center.lat, lon: center.lng });
      const data = await api(`/api/location/geocode?${params}`);
      if (request !== searchSequence.current) return;
      if (Array.isArray(data) && data.length > 0) {
        // Tự động chọn kết quả phù hợp nhất và bay bản đồ tới đó
        chooseResult(data[0]);
        if (data.length > 1) {
          setResults(data.slice(1, 5));
        } else {
          setResults([]);
        }
      } else {
        setResults([]);
        setError("Không tìm thấy địa chỉ phù hợp. Hãy thử gõ tên đường hoặc chọn trực tiếp trên bản đồ.");
      }
    } catch {
      if (request === searchSequence.current) setError("Không tìm kiếm được địa chỉ. Vui lòng thử lại hoặc chọn trực tiếp trên bản đồ.");
    } finally {
      if (request === searchSequence.current) setSearching(false);
    }
  }

  async function useApproximateLocation(request, locationError) {
    try {
      const res = await fetch('/api/location/approximate', { cache: 'no-store' });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (request !== locationSequence.current || !Number.isFinite(data.lat) || !Number.isFinite(data.lng)) return;
      move(data.lat, data.lng);

      if (locationError?.code === 1) {
        let isReloadPending = false;
        try {
          if (navigator.permissions?.query) {
            const perm = await navigator.permissions.query({ name: "geolocation" });
            if (perm?.state === "granted") isReloadPending = true;
          }
        } catch {}

        if (isReloadPending) {
          setError("Bạn vừa cấp quyền trên Chrome: Vui lòng bấm nút 'Reload' (Tải lại) ở thanh thông báo màu hồng phía trên cùng của trình duyệt để Chrome áp dụng quyền định vị.");
        } else {
          setError("Trình duyệt hoặc máy tính chưa cho phép định vị GPS. Vui lòng bấm nút 'Reload' màu hồng phía trên, hoặc bấm 'Tìm' ô địa chỉ để bay đến vị trí nhà bạn.");
        }
      } else {
        setError(`Thiết bị chưa trả về GPS chính xác (máy tính thường không có chip GPS). Bản đồ đã định vị tạm thời ở ${data.city || 'khu vực của bạn'}. Bạn hãy kéo ghim hoặc bấm 'Tìm' để đến đúng nhà.`);
      }
    } catch {
      if (request !== locationSequence.current) return;
      if (locationError?.code === 1) {
        setError("Quyền vị trí chưa được kích hoạt. Hãy bấm nút 'Reload' màu hồng ở thanh thông báo của Chrome hoặc kiểm tra Cài đặt hệ thống Mac.");
      } else if (locationError?.code === 3) {
        setError("Định vị GPS quá thời gian. Bạn vui lòng bấm nút 'Tìm' ở ô địa chỉ bên trên.");
      } else {
        setError("Không đo được toạ độ GPS từ thiết bị. Bạn vui lòng bấm 'Tìm' ở ô địa chỉ bên trên.");
      }
    } finally {
      if (request === locationSequence.current) setLocating(false);
    }
  }

  function locate() {
    if (!navigator.geolocation) return setError("Trình duyệt không hỗ trợ định vị.");
    const request = ++locationSequence.current;
    setLocating(true);
    setError("");
    clearAccuracy();

    const onSuccess = (p) => {
      if (request !== locationSequence.current) return;
      setLocating(false);
      setError("");
      const { latitude, longitude, accuracy: meters } = p.coords;
      move(latitude, longitude);
      if (Number.isFinite(meters) && leaflet.current && map.current) {
        setAccuracy(Math.ceil(meters));
        accuracyCircle.current = leaflet.current.circle([latitude, longitude], {
          radius: meters,
          color: "#1b4f8c",
          weight: 1,
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(map.current);
      }
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (locationError) => {
        if (request !== locationSequence.current) return;
        useApproximateLocation(request, locationError);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  return <Modal wide title={warehouse ? "Chọn vị trí kho" : "Chọn vị trí giao hàng"} onClose={onClose} footer={<><button className="btn secondary" onClick={onClose}>Huỷ</button><button className="btn" disabled={!point || loading} onClick={() => onSelect({ lat: point[0], lng: point[1], address, district })}>Xác nhận vị trí</button></>}>
    <div className="stack-sm">
      <div style={{ position: "relative" }}>
        <form className="row map-search" onSubmit={search}>
          <input
            className="input grow"
            aria-label="Tìm địa chỉ"
            placeholder="Tìm số nhà, đường hoặc địa điểm..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          <button className="btn secondary" type="submit" disabled={searching}>
            {searching ? "Đang tìm…" : "Tìm"}
          </button>
          <button className="btn secondary" type="button" disabled={locating} onClick={locate}>
            {locating ? "Đang định vị…" : "📍 Vị trí của tôi"}
          </button>
        </form>
        {results.length > 0 && (
          <div
            className="map-results"
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              zIndex: 50,
              background: "#fff",
              boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
              marginTop: 4,
              maxHeight: 180,
              overflowY: "auto",
              borderRadius: "var(--r-sm)",
            }}
          >
            {results.map((result) => (
              <button
                type="button"
                key={result.place_id || `${result.lat},${result.lon}`}
                onClick={() => chooseResult(result)}
                style={{
                  textAlign: "left",
                  width: "100%",
                  padding: "9px 12px",
                  border: 0,
                  borderBottom: "1px solid var(--line-soft)",
                  background: "transparent",
                  cursor: "pointer",
                  display: "block",
                }}
              >
                <div className="small strong">{result.display_name}</div>
                {result.address?.district && <div className="tiny muted">{result.address.district}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
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
