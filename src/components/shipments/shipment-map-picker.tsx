"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { AFRICA_CENTER, DEFAULT_ZOOM } from "@/lib/constants/routes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Field = "origin" | "destination";
type Point = { lat: number; lng: number };

const FIELD_META: Record<Field, { color: string; label: string }> = {
  origin: { color: "#10b981", label: "Origin" },
  destination: { color: "#ef4444", label: "Destination" },
};

function fieldIcon(color: string) {
  const html = `<div style="width:22px;height:22px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5)"></div>`;
  return L.divIcon({ className: "cf-location-icon", html, iconSize: [22, 22] });
}

function MapClick({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FitPoints({ points }: { points: [number, number][] }) {
  const map = useMap();
  const fitted = useRef<string | null>(null);
  const key = points.map((p) => p.map((n) => n.toFixed(5)).join(",")).join("|");

  useEffect(() => {
    if (points.length === 0) return;
    if (fitted.current === key) return;
    fitted.current = key;
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [key, map, points]);

  return null;
}

type ShipmentMapPickerProps = {
  origin: Point | null;
  destination: Point | null;
  onPick: (field: Field, lat: number, lng: number) => void;
  onClear: (field: Field) => void;
};

/**
 * Leaflet point picker used on the shipment form. Click the map to drop the
 * active point (origin or destination); both markers are shown at once, and
 * each can be cleared. This restores the map picker deferred from Episode 7 —
 * the lat/lng columns already exist on the `Shipment` model.
 */
export function ShipmentMapPicker({
  origin,
  destination,
  onPick,
  onClear,
}: ShipmentMapPickerProps) {
  const [active, setActive] = useState<Field>("origin");

  const points = useMemo<[number, number][]>(
    () =>
      [
        origin ? ([origin.lat, origin.lng] as [number, number]) : null,
        destination ? ([destination.lat, destination.lng] as [number, number]) : null,
      ].filter((p): p is [number, number] => p !== null),
    [origin, destination],
  );

  // Set active marker so the selected field's coordinate is pre-filled the
  // moment the user clicks anywhere on the map.
  const handlePick = (field: Field) => (lat: number, lng: number) => onPick(field, lat, lng);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(FIELD_META) as Field[]).map((f) => {
          const meta = FIELD_META[f];
          const point = f === "origin" ? origin : destination;
          const isActive = active === f;
          return (
            <div key={f} className="flex items-center gap-2">
              <Button
                type="button"
                variant={isActive ? "default" : "outline"}
                size="sm"
                onClick={() => setActive(f)}
                className="gap-1.5"
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: meta.color }}
                />
                {meta.label}
                {point ? (
                  <span className="font-mono text-[11px] opacity-80">
                    {point.lat.toFixed(4)}, {point.lng.toFixed(4)}
                  </span>
                ) : (
                  <span className="text-xs opacity-70">— click map</span>
                )}
              </Button>
              {point && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onClear(f)}
                  aria-label={`Clear ${meta.label.toLowerCase()} point`}
                >
                  ✕
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className={cn("relative z-0 h-[260px] overflow-hidden rounded-lg border")}>
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
          <MapClick onPick={handlePick(active)} />
          {origin && (
            <Marker
              position={[origin.lat, origin.lng]}
              icon={fieldIcon(FIELD_META.origin.color)}
            >
              <Popup>
                <div className="text-sm">
                  <span className="font-medium">Origin</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {origin.lat.toFixed(5)}, {origin.lng.toFixed(5)}
                  </span>
                </div>
              </Popup>
            </Marker>
          )}
          {destination && (
            <Marker
              position={[destination.lat, destination.lng]}
              icon={fieldIcon(FIELD_META.destination.color)}
            >
              <Popup>
                <div className="text-sm">
                  <span className="font-medium">Destination</span>
                  <span className="block font-mono text-xs text-muted-foreground">
                    {destination.lat.toFixed(5)}, {destination.lng.toFixed(5)}
                  </span>
                </div>
              </Popup>
            </Marker>
          )}
          <FitPoints points={points} />
        </MapContainer>
      </div>
    </div>
  );
}