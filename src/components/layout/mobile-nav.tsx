"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { NAV_ITEMS, SETTINGS_ITEM } from "@/components/layout/nav-items";
import { OrgSwitcher } from "@/components/shared/org-switcher";

export function MobileNav({ activeOrganizationId }: { activeOrganizationId: string | null }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard">
          <Logo />
        </Link>
      </div>
      <div className="border-b p-3">
        <OrgSwitcher activeOrganizationId={activeOrganizationId} />
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          if (!item.enabled) {
            return (
              <span
                key={item.href}
                className="flex cursor-not-allowed items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/70"
              >
                <Icon className="size-4" />
                <span className="flex-1">{item.label}</span>
              </span>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                pathname === item.href
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
        <Link
          href={SETTINGS_ITEM.href}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
            pathname.startsWith("/settings")
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
          )}
        >
          <SETTINGS_ITEM.icon className="size-4" />
          {SETTINGS_ITEM.label}
        </Link>
      </nav>
    </div>
  );
}
