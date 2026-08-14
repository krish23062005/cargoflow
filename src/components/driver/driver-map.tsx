"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Waypoint } from "@/lib/validators/route";
import { getWaypointTypeMeta } from "@/lib/constants/routes";
import { cn } from "@/lib/utils";

function waypointIcon(type: string, index: number) {
  const color = getWaypointTypeMeta(type).color;
  const html = `<div style="width:22px;height:22px;border-radius:9999px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.5);border:2px solid #fff">${index + 1}</div>`;
  return L.divIcon({ className: "cf-waypoint-icon", html, iconSize: [22, 22] });
}

function vehicleIcon() {
  const html = `<div class="cf-driver-vehicle"><div class="cf-driver-vehicle__dot cf-pulse"></div><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg></div>`;
  return L.divIcon({ className: "", html, iconSize: [36, 36], iconAnchor: [18, 18] });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (fitted.current || points.length === 0) return;
    fitted.current = true;
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 13 });
  }, [map, points]);

  return null;
}

type DriverMapProps = {
  waypoints: Waypoint[];
  geometry?: [number, number][] | null;
  vehicle?: { lat: number; lng: number } | null;
  labels?: { origin?: string; destination?: string };
  className?: string;
};

export function DriverMap({ waypoints, geometry, vehicle, labels, className }: DriverMapProps) {
  const allPoints = useMemo(() => {
    const pts: [number, number][] = [];
    if (geometry && geometry.length > 0) {
      pts.push(...geometry);
    } else {
      for (const w of waypoints) pts.push([w.lat, w.lng]);
    }
    if (vehicle) pts.push([vehicle.lat, vehicle.lng]);
    return pts;
  }, [geometry, waypoints, vehicle]);

  const polyline = useMemo(
    () => (geometry && geometry.length > 1 ? geometry : waypoints.map((w) => [w.lat, w.lng] as [number, number])),
    [geometry, waypoints],
  );

  if (allPoints.length === 0) return null;

  return (
    <MapContainer
      center={allPoints[0]}
      zoom={8}
      scrollWheelZoom={false}
      className={cn("z-0 h-52 w-full overflow-hidden rounded-xl border", className)}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds points={allPoints} />
      <Polyline positions={polyline} pathOptions={{ color: "#2563eb", weight: 4, opacity: 0.85 }} />
      {waypoints.map((w, i) => (
        <Marker key={i} position={[w.lat, w.lng]} icon={waypointIcon(w.type, i)}>
          {w.name ? <Popup>{w.name}</Popup> : null}
        </Marker>
      ))}
      {vehicle ? (
        <Marker position={[vehicle.lat, vehicle.lng]} icon={vehicleIcon()} zIndexOffset={1000}>
          <Popup>
            {labels?.origin && labels?.destination
              ? `${labels.origin} → ${labels.destination}`
              : "Your live position"}
          </Popup>
        </Marker>
      ) : null}
    </MapContainer>
  );
}