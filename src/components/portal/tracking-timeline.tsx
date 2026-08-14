"use client";

import { StatusTimeline } from "@/components/shipments/status-timeline";
import type { PortalEvent } from "@/server/portal";

/**
 * Customer-facing event trail. Deliberately reuses the dashboard's timeline
 * (same labels, styling, "current event" highlight) so the two views always
 * read consistently — the portal simply renders it unauthenticated.
 */
export function TrackingTimeline({ events }: { events: PortalEvent[] }) {
  return (
    <StatusTimeline
      events={events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        description: e.description,
        location: e.location,
        createdById: null,
        creator: null,
        createdAt: e.createdAt,
      }))}
    />
  );
}