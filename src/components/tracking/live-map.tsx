"use client";

import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { VehicleMarker } from "@/components/tracking/vehicle-marker";
import type { VehicleLive } from "@/server/tracking";
import { AFRICA_CENTER, DEFAULT_ZOOM } from "@/lib/constants/routes";

function FitFleet({ vehicles }: { vehicles: VehicleLive[] }) {
  const map = useMap();
  const fitted = useRef<string | null>(null);

  const positioned = vehicles.filter((v) => v.lat !== null && v.lng !== null);
  const key = positioned
    .map((v) => `${v.vehicleId}:${v.lat!.toFixed(5)},${v.lng!.toFixed(5)}`)
    .join("|");

  useEffect(() => {
    if (positioned.length === 0) return;
    if (fitted.current === key) return;
    fitted.current = key;
    const bounds = L.latLngBounds(
      positioned.map((v) => [v.lat as number, v.lng as number] as [number, number]),
    );
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);

  return null;
}

type LiveMapProps = {
  vehicles: VehicleLive[];
  statusFilter: string | null;
};

export function LiveMap({ vehicles, statusFilter }: LiveMapProps) {
  const visible = statusFilter
    ? vehicles.filter((v) => v.status === statusFilter)
    : vehicles;

  const positionedCount = useMemo(
    () => visible.filter((v) => v.lat !== null && v.lng !== null).length,
    [visible],
  );

  return (
    <div className="relative z-0 h-full w-full overflow-hidden rounded-lg border">
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
        {visible.map((v) => (
          <VehicleMarker key={v.vehicleId} vehicle={v} />
        ))}
        {positionedCount > 0 && <FitFleet vehicles={visible} />}
      </MapContainer>
    </div>
  );
}