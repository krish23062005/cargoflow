"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

type OrgSummary = {
  id: string;
  name: string;
  slug: string;
};

export function OrgSwitcher({
  activeOrganizationId,
}: {
  activeOrganizationId: string | null;
}) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<OrgSummary[] | null>(null);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void authClient.organization.list().then(({ data, error }) => {
      if (cancelled) return;
      setOrgs(
        error || !data
          ? []
          : data.map((o) => ({ id: o.id, name: o.name, slug: o.slug })),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadOrgs() {
    const { data, error } = await authClient.organization.list();
    if (!error && data) {
      setOrgs(
        data.map((o) => ({
          id: o.id,
          name: o.name,
          slug: o.slug,
        })),
      );
    } else {
      setOrgs([]);
    }
  }

  const activeOrg = orgs?.find((o) => o.id === activeOrganizationId);

  async function switchOrg(organizationId: string) {
    if (organizationId === activeOrganizationId) return;
    setSwitching(organizationId);
    const { error } = await authClient.organization.setActive({
      organizationId,
    });
    setSwitching(null);

    if (error) {
      toast.error(error.message ?? "Unable to switch organization");
      return;
    }

    await loadOrgs();
    router.refresh();
  }

  if (!orgs) {
    return <Skeleton className="h-9 w-52" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-label="Select organization"
          className="h-9 w-52 justify-between gap-2"
        >
          <span className="flex min-w-0 items-center gap-2">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">
              {switching ? "Switching…" : (activeOrg?.name ?? "No organization")}
            </span>
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {orgs.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">No organizations yet</p>
        ) : (
          orgs.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onSelect={() => switchOrg(org.id)}
              disabled={switching !== null}
            >
              <Building2 className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate">{org.name}</span>
              {org.id === activeOrganizationId ? (
                <Check className="size-4" />
              ) : switching === org.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : null}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/onboarding/create-org")}>
          <Plus className="size-4" />
          Create new organization
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
