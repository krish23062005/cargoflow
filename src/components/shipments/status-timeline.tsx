"use client";

import { Check, CircleDashed, MapPin } from "lucide-react";
import { getShipmentEventTypeLabel } from "@/lib/constants/shipments";
import { cn } from "@/lib/utils";

type TimelineEvent = {
  id: string;
  eventType: string;
  description: string | null;
  location: string | null;
  createdById: string | null;
  creator?: { name: string } | null;
  createdAt: Date | string;
};

export function StatusTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No events logged yet.
      </p>
    );
  }

  return (
    <ol className="relative space-y-6 border-l pl-6">
      {events.map((event, index) => {
        const isLast = index === events.length - 1;
        return (
          <li key={event.id} className="relative">
            <span
              className={cn(
                "absolute -left-[31px] flex size-4 items-center justify-center rounded-full border-2 bg-background",
                isLast
                  ? "border-emerald-500 text-emerald-500"
                  : "border-border text-muted-foreground/50",
              )}
            >
              {isLast ? <Check className="size-2.5" /> : <CircleDashed className="size-2.5" />}
            </span>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">{getShipmentEventTypeLabel(event.eventType)}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(event.createdAt).toLocaleString()}
              </p>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{event.description}</p>
            {event.location && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="size-3" /> {event.location}
              </p>
            )}
            {event.creator?.name && (
              <p className="mt-1 text-xs text-muted-foreground/80">by {event.creator.name}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}