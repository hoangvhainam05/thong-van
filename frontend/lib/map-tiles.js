import { resolveUrl } from "@/lib/api";

export function addMapTiles(L, map) {
  return L.tileLayer(resolveUrl('/api/location/tiles/{z}/{x}/{y}'), {
    maxZoom: 20,
    attribution: 'Powered by <a href="https://www.geoapify.com/" target="_blank" rel="noopener noreferrer">Geoapify</a> | <a href="https://openmaptiles.org/" target="_blank" rel="noopener noreferrer">© OpenMapTiles</a> | © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
  }).addTo(map);
}
