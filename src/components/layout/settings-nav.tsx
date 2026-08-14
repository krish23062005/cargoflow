"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScrollText, Settings, Users, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { isRoleAtLeast } from "@/lib/constants/permissions";

export function SettingsNav({ myRole }: { myRole: string }) {
  const pathname = usePathname();
  const canManageMembers = isRoleAtLeast(myRole, "admin");

  const items = [
    { href: "/settings/organization", label: "Organization", icon: Settings, show: true },
    { href: "/settings/members", label: "Members", icon: Users, show: canManageMembers },
    { href: "/settings/notifications", label: "Notifications", icon: Bell, show: true },
    { href: "/settings/audit-log", label: "Audit log", icon: ScrollText, show: canManageMembers },
  ].filter((i) => i.show);

  return (
    <nav className="flex flex-wrap items-center gap-1 border-b pb-3">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
