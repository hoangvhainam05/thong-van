import { resolveUrl } from "@/lib/api";

export function addMapTiles(L, map) {
  const satellite = L.tileLayer(resolveUrl('/api/location/tiles/{z}/{x}/{y}'), {
    maxNativeZoom: 20,
    maxZoom: 22,
    attribution: 'Ảnh vệ tinh © <a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">MapTiler</a> / Google / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OSM</a>',
  });

  const street = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxNativeZoom: 19,
    maxZoom: 22,
    attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
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
