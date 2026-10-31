import { resolveUrl } from "@/lib/api";

export function addMapTiles(L, map) {
  const satellite = L.tileLayer(resolveUrl('/api/location/tiles/{z}/{x}/{y}'), {
    maxNativeZoom: 20,
    maxZoom: 22,
    attribution: 'Ảnh vệ tinh © <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> / Google / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OSM</a>',
  });

  const street = L.tileLayer(resolveUrl('/api/location/tiles/{z}/{x}/{y}?type=street'), {
    maxNativeZoom: 20,
    maxZoom: 22,
    attribution: 'Bản đồ đường phố © Geoapify / Google / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OSM</a>',
  });

  satellite.addTo(map);

  L.control.layers(
    {
      "Vệ tinh": satellite,
      "Đường phố": street,
    },
    null,
    { position: "topright" }
  ).addTo(map);

  return satellite;
}
