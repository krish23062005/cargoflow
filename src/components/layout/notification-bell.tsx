"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { api } from "@/trpc/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSSE } from "@/hooks/use-sse";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getNotificationTypeLabel } from "@/lib/constants/notifications";

/**
 * Notification bell + dropdown for the dashboard topbar. Shows an unread
 * badge, the latest notifications (title, body, deep link, relative time),
 * and "mark all read". Reads via tRPC; a lightweight SSE subscription keeps
 * the badge fresh when `eta_delayed` / `eta` events arrive.
 */
const BELL_EVENTS = ["eta", "eta_delayed"] as const;

function timeAgo(date: Date): string {
  const diff = Math.max(0, Date.now() - date.getTime());
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const utils = api.useUtils();
  const unread = api.notification.unreadCount.useQuery(undefined);
  const list = api.notification.list.useQuery({ pageSize: 8 });
  const markAllRead = api.notification.markAllRead.useMutation();
  const markRead = api.notification.markRead.useMutation();

  const { status } = useSSE({
    url: "/api/sse/tracking",
    onEvent: () => {
      void unread.refetch();
      void list.refetch();
    },
    events: [...BELL_EVENTS],
  });

  const invalidated = useRef(false);
  useEffect(() => {
    if (status === "open" && !invalidated.current) {
      invalidated.current = true;
      void utils.notification.invalidate();
    }
  }, [status, utils]);

  const unreadCount = unread.data?.count ?? 0;
  const items = list.data?.items ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        >
          <Bell className="size-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 text-[10px]"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 max-h-[480px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-normal text-muted-foreground">
              {status === "open" ? "live" : "…"}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                className="text-[11px] text-muted-foreground hover:text-foreground"
                onClick={async () => {
                  await markAllRead.mutateAsync(undefined);
                  await Promise.all([unread.refetch(), list.refetch()]);
                }}
              >
                <CheckCheck className="mr-0.5 inline size-3.5" /> Mark all read
              </button>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="max-h-[340px] overflow-y-auto">
          {list.isLoading ? (
            <div className="space-y-2 p-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center">
              <Inbox className="size-6 text-muted-foreground/50" />
              <p className="text-sm font-medium">No notifications</p>
              <p className="text-xs text-muted-foreground">
                Shipment updates, ETA delays and alerts will appear here.
              </p>
            </div>
          ) : (
            <ul className="p-1">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className={`flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-accent ${
                      n.read ? "" : "bg-accent/40"
                    }`}
                    onClick={async () => {
                      if (!n.read) {
                        await markRead.mutateAsync({ id: n.id });
                        await Promise.all([unread.refetch(), list.refetch()]);
                      }
                      if (n.link) router.push(n.link);
                    }}
                  >
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        n.read ? "bg-transparent" : "bg-primary"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="mb-0.5 flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{n.title}</span>
                        <span
                          className={`shrink-0 text-[11px] text-muted-foreground ${
                            n.read ? "opacity-70" : ""
                          }`}
                        >
                          {timeAgo(new Date(n.createdAt))}
                        </span>
                      </span>
                      {n.body && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {n.body}
                        </span>
                      )}
                      <span className="mt-0.5 block text-[10px] uppercase tracking-wide text-muted-foreground/70">
                        {getNotificationTypeLabel(n.type)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DropdownMenuSeparator />
        <button
          type="button"
          className="block w-full px-3 py-2 text-center text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => utils.notification.invalidate()}
        >
          Refresh
        </button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}