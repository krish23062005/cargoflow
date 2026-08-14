"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import type { Waypoint } from "@/lib/validators/route";
import { getWaypointTypeMeta, WAYPOINT_TYPES } from "@/lib/constants/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type WaypointListProps = {
  waypoints: Waypoint[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onUpdate: (index: number, patch: Partial<Waypoint>) => void;
  onRemove: (index: number) => void;
  onMove: (index: number, direction: -1 | 1) => void;
};

export function WaypointList({
  waypoints,
  selectedIndex,
  onSelect,
  onUpdate,
  onRemove,
  onMove,
}: WaypointListProps) {
  if (waypoints.length === 0) {
    return (
      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
        No waypoints yet. Click on the map to add your first point.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {waypoints.map((w, i) => {
        const meta = getWaypointTypeMeta(w.type);
        const isSelected = selectedIndex === i;
        return (
          <li
            key={`${i}-${w.lat.toFixed(5)}-${w.lng.toFixed(5)}`}
            className={cn(
              "rounded-lg border p-2 transition-colors",
              isSelected ? "border-primary bg-accent/50" : "bg-card",
            )}
          >
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onSelect(i)}
                className="flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: meta.color }}
                aria-label={`Waypoint ${i + 1}`}
              >
                {i + 1}
              </button>
              <Input
                value={w.name ?? ""}
                onChange={(e) => onUpdate(i, { name: e.target.value })}
                placeholder={`${meta.label} name`}
                className="h-8 flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
                aria-label="Move up"
              >
                <ChevronUp />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={i === waypoints.length - 1}
                onClick={() => onMove(i, 1)}
                aria-label="Move down"
              >
                <ChevronDown />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onRemove(i)}
                aria-label="Remove waypoint"
              >
                <Trash2 />
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2 pl-8">
              <Select
                value={w.type}
                onValueChange={(v) => onUpdate(i, { type: v as Waypoint["type"] })}
              >
                <SelectTrigger className="h-8 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WAYPOINT_TYPES.map((t) => {
                    const m = getWaypointTypeMeta(t);
                    return (
                      <SelectItem key={t} value={t}>
                        <span className="mr-2 inline-block size-2 rounded-full" style={{ backgroundColor: m.color }} />
                        {m.label}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:inline">
                {w.lat.toFixed(4)}, {w.lng.toFixed(4)}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}