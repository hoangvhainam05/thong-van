"use client";

import { useEffect, useRef, useState } from "react";
import { api, loadToken } from "@/lib/api";
import { addMapTiles } from "@/lib/map-tiles";
export const ROUTE_COLORS = ["#1b4f8c", "#7a4fd1", "#16805a", "#d0661a", "#0f8b9c", "#b03a6a"];
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
      const stopGroups = new Map();
      let remaining = routes.length;
      routes.forEach((route, index) => {
        const color = route.color || ROUTE_COLORS[index % ROUTE_COLORS.length];
        const opacity = focusId != null && focusId !== route.id ? .25 : 1;
        const stops = route.stops.filter(valid);
        const routeDepot = valid(route.depot) ? route.depot : depot;
        if (routeDepot !== depot && (Number(routeDepot.lat) !== Number(depot?.lat) || Number(routeDepot.lng) !== Number(depot?.lng))) add(routeDepot, "K", "#142236", "depot");
        api(`/api/routes/${route.id}/geometry`, { token: loadToken() }).then(({ coordinates }) => {
          if (active && instance && Array.isArray(coordinates) && coordinates.length > 1) {
            L.polyline(coordinates, { color: "#fff", opacity: opacity * .9, weight: 8 }).addTo(instance);
            L.polyline(coordinates, { color, opacity, weight: 5 }).addTo(instance);
            setRouteDistances((current) => ({ ...current, [route.id]: pathDistanceKm(coordinates) }));
          }
        }).catch(() => {
          if (active) setRouteError((current) => current ? `${current}, ${route.name}` : route.name);
        }).finally(() => {
          remaining -= 1;
          if (active && remaining === 0) setLoadingRoad(false);
        });
        stops.forEach((stop) => {
          const key = `${Number(stop.lat)},${Number(stop.lng)}`;
          if (!stopGroups.has(key)) stopGroups.set(key, []);
          stopGroups.get(key).push({ stop, text: String(Number(stop.seq) || "•"), color: stop.state === "done" ? "#9fb0c3" : stop.state === "here" ? "#f2b100" : color, opacity, routeName: route.name });
        });
      });
      stopGroups.forEach((group) => {
        const coords = [Number(group[0].stop.lat), Number(group[0].stop.lng)];
        points.push(coords);
        const container = document.createElement("div");
        container.className = "route-map-stop-group";
        group.forEach(({ stop, text, color, opacity, routeName }) => {
          const badge = document.createElement("span");
          badge.className = "stop";
          badge.textContent = text;
          badge.style.background = color;
          badge.style.opacity = String(opacity);
          badge.title = `${routeName} · điểm ${text}${stop.label ? ` · ${stop.label}` : ""}`;
          container.appendChild(badge);
        });
        const width = group.length * 32 + (group.length - 1) * 3;
        const icon = L.divIcon({ className: "route-map-icon", html: container, iconSize: [width, 32], iconAnchor: [width / 2, 16] });
        const marker = L.marker(coords, { icon, title: group.map(({ text, routeName }) => `${routeName} · điểm ${text}`).join(", ") }).addTo(instance);
        const labels = group.map(({ stop, text, routeName }) => `${routeName} · điểm ${text}${stop.label ? ` · ${stop.label}` : ""}`);
        const tooltip = document.createElement("span");
        tooltip.textContent = labels.join(" | ");
        marker.bindTooltip(tooltip);
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
      {routes.map((route, index) => {
        const distance = routeDistances[route.id];
        const stopSequence = route.stops.map((stop, stopIndex) => Number(stop.seq) || stopIndex + 1);
        return <div className="map-legend-route" key={route.id}>
          <span className="map-legend-item">
            <i className="map-legend-line" style={{ borderColor: route.color || ROUTE_COLORS[index % ROUTE_COLORS.length] }} />
            <span>{route.name} · Kho → {stopSequence.map((sequence) => `điểm ${sequence}`).join(" → ")}{distance != null ? ` (${formatKm(distance)})` : ""}</span>
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
