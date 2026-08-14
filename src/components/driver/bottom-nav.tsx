"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, Home, Map as MapIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/driver", label: "Home", icon: Home },
  { href: "/driver/navigate", label: "Navigate", icon: MapIcon },
  { href: "/driver/history", label: "My trips", icon: Clock },
] as const;

/** Mobile-first bottom navigation for the driver app. */
export function BottomNav() {
  const pathname = usePathname();
  if (pathname.startsWith("/driver/login")) return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Driver navigation"
    >
      <div className="mx-auto flex h-16 w-full max-w-md items-stretch justify-around">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active =
            href === "/driver"
              ? pathname === "/driver"
              : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              prefetch
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-[76px] flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors",
                active
                  ? "text-primary"
                  : "text-muted-foreground active:text-primary",
              )}
            >
              <span
                className={cn(
                  "grid place-items-center rounded-full px-4 py-1 transition-colors",
                  active && "bg-primary/10",
                )}
              >
                <Icon className="size-6" strokeWidth={active ? 2.2 : 1.8} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}