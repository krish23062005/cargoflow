"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { enqueueTracking } from "@/lib/offline/queue";

const TRACK_INTERVAL_MS = 10000;

type Sentry = {
  lat: number;
  lng: number;
  speedKmh?: number;
  headingDeg?: number;
  accuracyM?: number;
};

export type DriverTrackState = "starting" | "active" | "off" | "denied";

/**
 * Continuous geolocation reporting for a driver's assigned vehicle:
 * watches the phone position, keeps the latest sample, and posts it to the
 * tracking ingest endpoint every few seconds so dashboards stay live.
 * Exposes the latest coordinate so maps can render the moving truck.
 */
export function useDriverTracking(vehicleId: string | undefined) {
  const [livePoint, setLivePoint] = useState<{
    speedKmh: number | null;
    recordedAt: Date | null;
  }>({ speedKmh: null, recordedAt: null });
  const [liveCoord, setLiveCoord] = useState<{ lat: number; lng: number } | null>(null);
  const [reporting, setReporting] = useState(false);
  const sentryRef = useRef<Sentry | null>(null);

  const postPoint = useCallback(async () => {
    const p = sentryRef.current;
    if (!p || !vehicleId) return;
    const body = {
      points: [
        {
          vehicleId,
          lat: p.lat,
          lng: p.lng,
          speedKmh: p.speedKmh,
          headingDeg: p.headingDeg,
          accuracyM: p.accuracyM,
          source: "driver-pwa",
        },
      ],
    };
    setLivePoint({ speedKmh: p.speedKmh ?? null, recordedAt: new Date() });
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      void enqueueTracking(body);
      return;
    }
    try {
      await fetch("/api/tracking/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch {
      // Reconnect failure: keep a compact queued copy so the dashboard still
      // gets the latest position once network returns.
      void enqueueTracking(body);
    }
  }, [vehicleId]);

  useEffect(() => {
    if (!vehicleId) return;
    if (!("geolocation" in navigator)) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        sentryRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          speedKmh: pos.coords.speed != null ? Math.round(pos.coords.speed * 3.6) : undefined,
          headingDeg: pos.coords.heading ?? undefined,
          accuracyM: pos.coords.accuracy ?? undefined,
        };
        setReporting(true);
        setLiveCoord({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => setReporting(false),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    const timer = setInterval(postPoint, TRACK_INTERVAL_MS);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
      sentryRef.current = null;
    };
  }, [vehicleId, postPoint]);

  const gpsSupported = typeof navigator !== "undefined" && "geolocation" in navigator;
  const trackState: DriverTrackState = !vehicleId
    ? "off"
    : !gpsSupported
      ? "denied"
      : reporting
        ? "active"
        : "starting";

  return { liveCoord, livePoint, trackState };
}