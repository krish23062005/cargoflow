"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { Waypoint } from "@/lib/validators/route";
import { AFRICA_CENTER, DEFAULT_ZOOM, getWaypointTypeMeta } from "@/lib/constants/routes";

function waypointIcon(type: string, index: number) {
  const meta = getWaypointTypeMeta(type);
  const color = meta.color;
  const html = `<div style="width:26px;height:26px;border-radius:9999px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 1px 3px rgba(0,0,0,.5);border:2px solid #fff">${index + 1}</div>`;
  return L.divIcon({ className: "cf-waypoint-icon", html, iconSize: [26, 26] });
}

function ClickCatch({ onAdd }: { onAdd?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onAdd) onAdd(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitBounds({ points, fitKey }: { points: [number, number][]; fitKey: string }) {
  const map = useMap();
  const fitted = useRef<string | null>(null);

  useEffect(() => {
    if (points.length === 0) return;
    if (fitted.current === fitKey) return;
    fitted.current = fitKey;
    map.fitBounds(L.latLngBounds(points), { padding: [36, 36] });
  }, [fitKey, map, points]);

  return null;
}

type RouteMapProps = {
  waypoints: Waypoint[];
  geometry?: [number, number][] | null;
  interactive?: boolean;
  onAddWaypoint?: (lat: number, lng: number) => void;
  onMarkerClick?: (index: number) => void;
  showPopup?: boolean;
  className?: string;
};

/**
 * Reusable Leaflet route map: tile layer, numbered waypoint markers, an OSRM
 * polyline when present, and an optional "click to add a waypoint" handler
 * for the route builder.
 */
export function RouteMap({
  waypoints,
  geometry,
  interactive = false,
  onAddWaypoint,
  onMarkerClick,
  showPopup = true,
  className = "h-[420px]",
}: RouteMapProps) {
  const fitKey = useMemo(
    () => (geometry?.length ? "geometry" : waypoints.map((w) => `${w.lat.toFixed(5)},${w.lng.toFixed(5)}`).join("|")),
    [geometry, waypoints],
  );

  const fitPoints = useMemo<[number, number][]>(
    () =>
      (geometry && geometry.length
        ? geometry
        : waypoints.map((w) => [w.lat, w.lng] as [number, number])) ?? [],
    [geometry, waypoints],
  );

  const line = useMemo<[number, number][]>(
    () =>
      geometry && geometry.length
        ? geometry
        : waypoints.map((w) => [w.lat, w.lng] as [number, number]),
    [geometry, waypoints],
  );

  return (
    <div className={`${className} relative z-0 overflow-hidden rounded-lg border`}>
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
        {interactive && onAddWaypoint ? (
          <ClickCatch onAdd={onAddWaypoint} />
        ) : (
          <ClickCatch />
        )}
        {line.length > 1 && (
          <Polyline positions={line} pathOptions={{ color: "#0ea5e9", weight: 4, opacity: 0.85 }} />
        )}
        {waypoints.map((w, i) => {
          const meta = getWaypointTypeMeta(w.type);
          return (
            <Marker
              key={`${i}-${w.lat.toFixed(5)}-${w.lng.toFixed(5)}-${w.type}`}
              position={[w.lat, w.lng]}
              icon={waypointIcon(w.type, i)}
              eventHandlers={
                onMarkerClick ? { click: () => onMarkerClick(i) } : undefined
              }
            >
              {showPopup && (
                <Popup>
                  <div className="min-w-36 space-y-0.5 text-sm">
                    <p className="font-medium">
                      {i + 1}. {w.name || meta.label}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {w.lat.toFixed(5)}, {w.lng.toFixed(5)}
                    </p>
                  </div>
                </Popup>
              )}
            </Marker>
          );
        })}
        <FitBounds points={fitPoints} fitKey={fitKey} />
      </MapContainer>
    </div>
  );
}