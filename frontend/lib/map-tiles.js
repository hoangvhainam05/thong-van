import { resolveUrl } from "@/lib/api";

export function addMapTiles(L, map) {
  const satellite = L.tileLayer(resolveUrl('/api/location/tiles/satellite/{z}/{x}/{y}?v=2'), {
    maxNativeZoom: 20,
    maxZoom: 22,
    attribution: 'Ảnh vệ tinh © <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> / Google / Esri',
  });

  const hybrid = L.tileLayer(resolveUrl('/api/location/tiles/hybrid/{z}/{x}/{y}?v=2'), {
    maxNativeZoom: 20,
    maxZoom: 22,
    attribution: 'Vệ tinh lai © Google / MapTiler',
  });

  const street = L.tileLayer(resolveUrl('/api/location/tiles/street/{z}/{x}/{y}?v=2'), {
    maxNativeZoom: 20,
    maxZoom: 22,
    attribution: 'Bản đồ đường phố © Geoapify / Google / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OSM</a>',
  });

  hybrid.addTo(map);

  L.control.layers(
    {
      "Vệ tinh": satellite,
      "Vệ tinh có tên đường": hybrid,
      "Đường phố": street,
    },
    null,
    { position: "topright" }
  ).addTo(map);

  return hybrid;
}
