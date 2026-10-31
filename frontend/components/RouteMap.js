"use client";

import { useEffect, useRef, useState } from "react";
import { api, loadToken } from "@/lib/api";
import { addMapTiles } from "@/lib/map-tiles";
export const ROUTE_COLORS = ["#1b4f8c", "#7a4fd1", "#16805a", "#d0661a", "#0f8b9c", "#b03a6a"];
const valid = (p) => p && p.lat != null && p.lng != null && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng));

export default function RouteMap({ depot, routes = [], loose = [], height = 460, focusId }) {
  const element = useRef(null);
  const [routeError, setRouteError] = useState("");
  const [loadingRoad, setLoadingRoad] = useState(false);
  const data = JSON.stringify({ depot, routes, loose, focusId });
  useEffect(() => {
    let active = true, instance, resizeObserver = null;
    const { depot, routes, loose, focusId } = JSON.parse(data);
    setRouteError(""); setLoadingRoad(routes.length > 0);
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
            L.polyline(coordinates, { color, opacity, weight: 4 }).addTo(instance);
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
  return <div className="stack-sm"><div className="map-box"><div ref={element} style={{ height }} aria-label="Bản đồ tuyến giao hàng" />
    <div className="map-legend"><span>■ Kho</span>{routes.map((r, i) => <span key={r.id} style={{ color: r.color || ROUTE_COLORS[i % ROUTE_COLORS.length], fontWeight: 600 }}>— {r.name}</span>)}{loose.length > 0 && <span>● Chưa xếp tuyến</span>}<span>Đường đi ô tô</span></div>
  </div>{loadingRoad && <p className="small muted">Đang tải đường đi ô tô…</p>}{routeError && <div className="notice warn">Không tải được đường đi cho tuyến {routeError}. Vui lòng kiểm tra kết nối và cấu hình OpenRouteService rồi tải lại.</div>}</div>;
}
