"use client";

import { useMemo } from "react";
import L from "leaflet";
import { Marker, Popup } from "react-leaflet";
import { Truck } from "lucide-react";
import type { VehicleLive } from "@/server/tracking";
import { getVehicleStatusLabel } from "@/lib/constants/vehicles";
import { VehicleStatusBadge } from "@/components/shared/vehicle-status-badge";
import { formatEtaDuration } from "@/lib/utils/eta-calculator";

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#10b981",
  IN_USE: "#8b5cf6",
  IN_TRANSIT: "#0ea5e9",
  MAINTENANCE: "#f59e0b",
  DECOMMISSIONED: "#64748b",
};

function markerIcon(status: string, headingDeg: number | null) {
  const color = STATUS_COLORS[status] ?? "#64748b";
  const rotate = headingDeg ?? 0;
  const html = `
    <div style="position:relative;width:38px;height:38px;">
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:32px;height:32px;border-radius:9999px;background:${color};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${rotate}deg)"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
      </div>
      <div style="position:absolute;bottom:0;left:50%;transform:translateX(-50%);width:6px;height:6px;border-radius:9999px;background:${color};border:1px solid #fff;"></div>
    </div>`;
  return L.divIcon({ className: "cf-vehicle-marker", html, iconSize: [38, 38], iconAnchor: [19, 38] });
}

const fmtTime = (d: Date | string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
};

export function VehicleMarker({ vehicle }: { vehicle: VehicleLive }) {
  const icon = useMemo(
    () => markerIcon(vehicle.status, vehicle.headingDeg),
    [vehicle.status, vehicle.headingDeg],
  );

  if (vehicle.lat === null || vehicle.lng === null) return null;

  return (
    <Marker position={[vehicle.lat, vehicle.lng]} icon={icon}>
      <Popup>
        <div className="min-w-44 space-y-1.5 text-sm">
          <div className="flex items-center gap-2">
            <Truck className="size-3.5 text-muted-foreground" />
            <span className="font-semibold">{vehicle.plateNumber}</span>
            {vehicle.make && (
              <span className="text-xs text-muted-foreground">
                {vehicle.make} {vehicle.model}
              </span>
            )}
          </div>
          <VehicleStatusBadge status={vehicle.status} />
          {vehicle.driverName && (
            <p className="text-xs text-muted-foreground">Driver: {vehicle.driverName}</p>
          )}
          <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
            <span className="text-muted-foreground">Speed</span>
            <span>{vehicle.speedKmh != null ? `${Math.round(vehicle.speedKmh)} km/h` : "—"}</span>
            <span className="text-muted-foreground">Heading</span>
            <span>{vehicle.headingDeg != null ? `${Math.round(vehicle.headingDeg)}°` : "—"}</span>
            <span className="text-muted-foreground">Updated</span>
            <span>{fmtTime(vehicle.recordedAt)}</span>
            <span className="text-muted-foreground">Status: </span>
            <span>{getVehicleStatusLabel(vehicle.status)}</span>
            {vehicle.eta && (
              <>
                <span className="text-muted-foreground">ETA</span>
                <span
                  className={vehicle.eta.isDelayed ? "font-medium text-amber-600" : "text-emerald-600"}
                >
                  {vehicle.eta.etaAt
                    ? new Date(vehicle.eta.etaAt).toLocaleTimeString(undefined, {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}{" "}
                  {vehicle.eta.minutes != null
                    ? `(${formatEtaDuration(vehicle.eta.minutes)})`
                    : ""}
                  {vehicle.eta.isDelayed ? " · late" : ""}
                </span>
                <span className="text-muted-foreground">Cargo</span>
                <span className="truncate">#{vehicle.eta.trackingNumber}</span>
              </>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}