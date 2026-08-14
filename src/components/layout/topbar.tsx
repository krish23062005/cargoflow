"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/theme-toggle";
import { OrgSwitcher } from "@/components/shared/org-switcher";
import { UserMenu } from "@/components/shared/user-menu";
import { NotificationBell } from "@/components/layout/notification-bell";

export function Topbar({
  activeOrganizationId,
  user,
}: {
  activeOrganizationId: string | null;
  user: { name: string; email: string; image?: string | null };
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <MobileNav activeOrganizationId={activeOrganizationId} />
        </SheetContent>
      </Sheet>

      <div className="hidden lg:block">
        <OrgSwitcher activeOrganizationId={activeOrganizationId} />
      </div>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <NotificationBell />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
