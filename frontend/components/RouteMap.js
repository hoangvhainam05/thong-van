"use client";

import { useEffect, useRef, useState } from "react";
import { api, loadToken } from "@/lib/api";
import { addMapTiles } from "@/lib/map-tiles";
export const ROUTE_COLORS = ["#1b4f8c", "#7a4fd1", "#16805a", "#d0661a", "#0f8b9c", "#b03a6a"];
const OUTBOUND_COLOR = "#16803c";
const RETURN_COLOR = "#2563eb";
const valid = (p) => p && p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));

function distanceKm(a, b) {
  const radians = (degrees) => degrees * Math.PI / 180;
  const [latA, lngA] = a.map(Number);
  const [latB, lngB] = b.map(Number);
  const dLat = radians(latB - latA);
  const dLng = radians(lngB - lngA);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(latA)) * Math.cos(radians(latB)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function pathDistanceKm(coordinates) {
  return coordinates.slice(1).reduce((sum, point, index) => sum + distanceKm(coordinates[index], point), 0);
}

function splitAtLastStop(coordinates, lastStop) {
  if (coordinates.length < 2 || !valid(lastStop)) return { outbound: coordinates, returning: [] };
  const target = [Number(lastStop.lat), Number(lastStop.lng)];
  let splitIndex = 0;
  let nearestDistance = Infinity;
  coordinates.forEach((point, index) => {
    const distance = distanceKm(point, target);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      splitIndex = index;
    }
  });
  return {
    outbound: coordinates.slice(0, splitIndex + 1),
    returning: coordinates.slice(splitIndex),
  };
}

function formatKm(km) {
  return `${km.toFixed(1).replace(".", ",")} km`;
}

export default function RouteMap({ depot, routes = [], loose = [], height = 460, focusId }) {
  const element = useRef(null);
  const [routeError, setRouteError] = useState("");
  const [loadingRoad, setLoadingRoad] = useState(false);
  const [routeDistances, setRouteDistances] = useState({});
  const data = JSON.stringify({ depot, routes, loose, focusId });
  useEffect(() => {
    let active = true, instance, resizeObserver = null;
    const { depot, routes, loose, focusId } = JSON.parse(data);
    setRouteError(""); setRouteDistances({}); setLoadingRoad(routes.length > 0);
    import("leaflet").then((module) => {
      if (!active || !element.current) return;
      const L = module.default || module;
      instance = L.map(element.current);
      addMapTiles(L, instance);
      const points = [];
      const add = (p, text, color, type, opacity = 1) => {
        if (!valid(p)) return;
        const coords = [Number(p.lat), Number(p.lng)]; points.push(coords);
        const icon = L.divIcon({ className: "route-map-icon", html: `<span class="${type}" style="background:${color};opacity:${opacity}">${text}</span>`, iconSize: [30, 30], iconAnchor: [15, 15] });
        const marker = L.marker(coords, { icon }).addTo(instance);
        if (p.label) { const label = document.createElement("span"); label.textContent = String(p.label); marker.bindTooltip(label); }
      };
      if (valid(depot)) add(depot, "K", "#142236", "depot");
      let remaining = routes.length;
      routes.forEach((route, index) => {
        const color = route.color || ROUTE_COLORS[index % ROUTE_COLORS.length];
        const opacity = focusId != null && focusId !== route.id ? .25 : 1;
        const stops = route.stops.filter(valid);
        const routeDepot = valid(route.depot) ? route.depot : depot;
        if (routeDepot !== depot && (Number(routeDepot.lat) !== Number(depot?.lat) || Number(routeDepot.lng) !== Number(depot?.lng))) add(routeDepot, "K", "#142236", "depot");
        api(`/api/routes/${route.id}/geometry`, { token: loadToken() }).then(({ coordinates }) => {
          if (active && instance && Array.isArray(coordinates) && coordinates.length > 1) {
            const split = splitAtLastStop(coordinates, stops[stops.length - 1]);
            const drawPath = (path, pathColor) => {
              if (path.length < 2) return;
              L.polyline(path, { color: "#fff", opacity: opacity * .9, weight: 8 }).addTo(instance);
              L.polyline(path, { color: pathColor, opacity, weight: 5 }).addTo(instance);
            };
            drawPath(split.outbound, OUTBOUND_COLOR);
            drawPath(split.returning, RETURN_COLOR);
            setRouteDistances((current) => ({
              ...current,
              [route.id]: {
                outbound: pathDistanceKm(split.outbound),
                returning: pathDistanceKm(split.returning),
              },
            }));
          }
        }).catch(() => {
          if (active) setRouteError((current) => current ? `${current}, ${route.name}` : route.name);
        }).finally(() => {
          remaining -= 1;
          if (active && remaining === 0) setLoadingRoad(false);
        });
        stops.forEach(s => add(s, String(Number(s.seq) || "•"), s.state === "done" ? "#9fb0c3" : s.state === "here" ? "#f2b100" : color, "stop", opacity));
      });
      loose.forEach(p => add(p, "•", "#607287", "stop"));
      if (points.length === 1) instance.setView(points[0], 15);
      else if (points.length) instance.fitBounds(points, { padding: [35, 35], maxZoom: 16 });
      else instance.setView([16.0678, 108.2208], 12);
      if (typeof ResizeObserver !== "undefined" && element.current) {
        resizeObserver = new ResizeObserver(() => instance?.invalidateSize());
        resizeObserver.observe(element.current);
      }
      setTimeout(() => instance?.invalidateSize(), 100);
      setTimeout(() => instance?.invalidateSize(), 350);
    });
    return () => { active = false; resizeObserver?.disconnect(); instance?.remove(); };
  }, [data]);
  return <div className="stack-sm">
    <div className="map-box"><div ref={element} style={{ height }} aria-label="Bản đồ tuyến giao hàng" /></div>
    <div className="map-legend" aria-label="Chú thích bản đồ">
      <b className="map-legend-heading">Chú thích đường đi</b>
      {routes.map((route) => {
        const distance = routeDistances[route.id];
        const stopSequence = route.stops.map((stop, index) => Number(stop.seq) || index + 1);
        const outboundDescription = stopSequence.length
          ? `Kho → ${stopSequence.map((sequence) => `điểm ${sequence}`).join(" → ")}`
          : "Kho → các điểm giao";
        const prefix = routes.length > 1 ? `${route.name} · ` : "";
        return <div className="map-legend-route" key={route.id}>
          <span className="map-legend-item">
            <i className="map-legend-line" style={{ borderColor: OUTBOUND_COLOR }} />
            <span>{prefix}Đi (xanh lá): {outboundDescription}{distance ? ` (${formatKm(distance.outbound)})` : ""}</span>
          </span>
          <span className="map-legend-item">
            <i className="map-legend-line" style={{ borderColor: RETURN_COLOR }} />
            <span>{prefix}Về (xanh dương): điểm cuối → Kho{distance ? ` (${formatKm(distance.returning)})` : ""}</span>
          </span>
        </div>;
      })}
      <span className="map-legend-item"><i className="map-legend-marker depot-marker">K</i><span>Kho</span></span>
      {routes.length > 0 && <span className="map-legend-item"><i className="map-legend-marker">1</i><span>Số trên điểm là thứ tự giao</span></span>}
      {loose.length > 0 && <span className="map-legend-item"><i className="map-legend-marker loose-marker">•</i><span>Chưa xếp tuyến</span></span>}
      <span className="map-legend-item">Đường đi ô tô</span>
    </div>
    {loadingRoad && <p className="small muted">Đang tải đường đi ô tô…</p>}{routeError && <div className="notice warn">Không tải được đường đi cho tuyến {routeError}. Vui lòng kiểm tra kết nối và cấu hình OpenRouteService rồi tải lại.</div>}
  </div>;
}
