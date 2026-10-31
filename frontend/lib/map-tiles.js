import { resolveUrl } from "@/lib/api";

export function addMapTiles(L, map) {
  return L.tileLayer(resolveUrl('/api/location/tiles/{z}/{x}/{y}'), {
    maxNativeZoom: 20,
    maxZoom: 22,
    attribution: '© <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  }).addTo(map);
}
