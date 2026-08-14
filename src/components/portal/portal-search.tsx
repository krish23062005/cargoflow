"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, Search } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Public tracking search. Takes any tracking number and navigates to the
 * shipment's live tracking page.
 */
export function PortalSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trackingNumber = value.trim().toUpperCase();
    if (!trackingNumber) return;
    router.push(`/portal/${encodeURIComponent(trackingNumber)}`);
  };

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <Logo />
          <span className="text-sm font-semibold">CargoFlow</span>
        </div>
        <span className="text-xs text-muted-foreground">Shipment tracking</span>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-6">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Package className="size-7" />
        </div>
        <div className="space-y-1 text-center">
          <h1 className="text-xl font-semibold">Track your shipment</h1>
          <p className="text-sm text-muted-foreground">
            Enter the tracking number you received from your logistics provider.
          </p>
        </div>

        <form onSubmit={submit} className="w-full space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g. CF-NG-20260812-W7TA"
              className="h-12 pl-9 font-mono uppercase"
              autoFocus
            />
          </div>
          <Button type="submit" className="h-12 w-full" disabled={!value.trim()}>
            Track shipment
          </Button>
        </form>
      </main>

      <footer className="border-t px-6 py-4 text-center text-xs text-muted-foreground">
        Powered by CargoFlow
      </footer>
    </div>
  );
}