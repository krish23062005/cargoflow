"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Waypoint } from "@/lib/validators/route";
import { AFRICA_CENTER, DEFAULT_ZOOM, getWaypointTypeMeta } from "@/lib/constants/routes";

function originIcon() {
  return L.divIcon({
    className: "cf-origin-icon",
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:#10b981;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.4);border:2.5px solid #fff"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>`,
    iconSize: [26, 26],
  });
}

function destinationIcon() {
  return L.divIcon({
    className: "cf-destination-icon",
    html: `<div style="width:26px;height:26px;border-radius:9999px;background:#ef4444;color:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 4px rgba(0,0,0,.4);border:2.5px solid #fff"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg></div>`,
    iconSize: [26, 26],
  });
}

function waypointIcon(type: string, index: number) {
  const meta = getWaypointTypeMeta(type);
  const html = `<div style="width:22px;height:22px;border-radius:9999px;background:${meta.color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.5);border:2px solid #fff">${index + 1}</div>`;
  return L.divIcon({ className: "cf-waypoint-icon", html, iconSize: [22, 22] });
}

function vehicleIcon() {
  const html = `
    <div style="position:relative;width:38px;height:38px;">
      <span style="position:absolute;inset:0;border-radius:9999px;background:#0ea5e9;opacity:.35;animation:cf-pulse 1.8s ease-out infinite;"></span>
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:9999px;background:#0ea5e9;border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
      </div>
    </div>`;
  return L.divIcon({ className: "cf-vehicle-marker", html, iconSize: [38, 38], iconAnchor: [19, 19] });
}

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fitted = useRef<string | null>(null);
  const key = points.map((p) => p.join(",")).join("|");

  useEffect(() => {
    if (points.length === 0) return;
    if (fitted.current === key) return;
    fitted.current = key;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
  }, [key, map, points]);

  return null;
}

type PortalTrackingMapProps = {
  waypoints: Waypoint[];
  geometry?: [number, number][] | null;
  vehiclePosition: { lat: number; lng: number } | null;
};

/**
 * Customer-facing map for the tracking portal. Shows the planned route
 * (waypoints + polyline), the pickup/drop-off pins, and the truck's live
 * position when one is available.
 */
export function PortalTrackingMap({
  waypoints,
  geometry,
  vehiclePosition,
}: PortalTrackingMapProps) {
  const origin = waypoints[0];
  const destination = waypoints[waypoints.length - 1];

  const line = useMemo<[number, number][]>(
    () =>
      (geometry && geometry.length
        ? geometry
        : waypoints.map((w) => [w.lat, w.lng] as [number, number])) ?? [],
    [geometry, waypoints],
  );

  const fitPoints = useMemo<[number, number][]>(() => {
    const pts: [number, number][] =
      geometry && geometry.length
        ? geometry
        : (waypoints.map((w) => [w.lat, w.lng] as [number, number]));
    if (vehiclePosition) pts.push([vehiclePosition.lat, vehiclePosition.lng]);
    return pts;
  }, [geometry, waypoints, vehiclePosition]);

  return (
    <div className="relative z-0 h-[260px] w-full overflow-hidden rounded-xl border sm:h-[360px]">
      <MapContainer
        center={AFRICA_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {line.length > 1 && (
          <Polyline
            positions={line}
            pathOptions={{ color: "#0ea5e9", weight: 3, opacity: 0.7, dashArray: "4 6" }}
          />
        )}
        {origin && (
          <Marker position={[origin.lat, origin.lng]} icon={originIcon()}>
            <Popup>
              <div className="min-w-32 text-sm">
                <p className="font-medium">Pickup</p>
                {origin.name ? <p className="text-xs text-muted-foreground">{origin.name}</p> : null}
              </div>
            </Popup>
          </Marker>
        )}
        {destination && destination !== origin && (
          <Marker position={[destination.lat, destination.lng]} icon={destinationIcon()}>
            <Popup>
              <div className="min-w-32 text-sm">
                <p className="font-medium">Drop-off</p>
                {destination.name ? (
                  <p className="text-xs text-muted-foreground">{destination.name}</p>
                ) : null}
              </div>
            </Popup>
          </Marker>
        )}
        {waypoints.slice(1, -1).map((w, i) => (
          <Marker key={`mid-${i}-${w.lat.toFixed(5)}-${w.lng.toFixed(5)}`} position={[w.lat, w.lng]} icon={waypointIcon(w.type, i + 1)}>
            <Popup>
              <div className="min-w-32 text-sm">
                <p className="font-medium">{getWaypointTypeMeta(w.type).label}</p>
                {w.name ? <p className="text-xs text-muted-foreground">{w.name}</p> : null}
              </div>
            </Popup>
          </Marker>
        ))}
        {vehiclePosition && (
          <Marker position={[vehiclePosition.lat, vehiclePosition.lng]} icon={vehicleIcon()}>
            <Popup>
              <div className="min-w-32 text-sm">
                <p className="font-medium">Current location</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {vehiclePosition.lat.toFixed(5)}, {vehiclePosition.lng.toFixed(5)}
                </p>
              </div>
            </Popup>
          </Marker>
        )}
        <FitBounds points={fitPoints} />
      </MapContainer>
    </div>
  );
}