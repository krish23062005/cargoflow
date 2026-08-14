"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  MapPin,
  Package,
  PackageCheck,
  Truck,
} from "lucide-react";
import { api } from "@/trpc/client";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { OnboardingChecklist, type ChecklistStep } from "@/components/shared/onboarding-checklist";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardHome({
  organizationName,
  memberCount,
  canViewAudit,
  canViewFleet,
  canViewDrivers,
  canViewShipments,
  canViewReports,
}: {
  organizationName: string;
  memberCount: number;
  canViewAudit: boolean;
  canViewFleet: boolean;
  canViewDrivers: boolean;
  canViewShipments: boolean;
  canViewReports: boolean;
}) {
  const recent = api.audit.recent.useQuery(undefined, { enabled: canViewAudit });
  const fleetSummary = api.fleet.summary.useQuery(undefined, { enabled: canViewFleet });
  const driverSummary = api.driver.summary.useQuery(undefined, { enabled: canViewDrivers });
  const shipmentSummary = api.shipment.summary.useQuery(undefined, { enabled: canViewShipments });
  const reportOverview = api.report.overview.useQuery({}, { enabled: canViewReports });

  const steps: ChecklistStep[] = [
    { label: "Create your organization", done: true },
    { label: "Invite your team", done: memberCount > 1, href: "/settings/members", cta: "Invite" },
    {
      label: "Add your first vehicle",
      done: !canViewFleet || (fleetSummary.data?.total ?? 0) > 0,
      href: "/fleet/new",
      cta: "Add vehicle",
    },
    {
      label: "Add your first driver",
      done: !canViewDrivers || (driverSummary.data?.total ?? 0) > 0,
      href: "/drivers/new",
      cta: "Add driver",
    },
    {
      label: "Create your first shipment",
      done: !canViewShipments || (shipmentSummary.data?.total ?? 0) > 0,
      href: "/shipments/new",
      cta: "Create shipment",
    },
  ];

  const recentEntries = recent.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome to {organizationName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Get your fleet moving — here&apos;s what to set up next.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/settings/members">
            Invite your team <ArrowRight />
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {canViewFleet && (
          <StatCard
            label="Total vehicles"
            value={fleetSummary.data?.total}
            icon={Truck}
            isLoading={fleetSummary.isLoading}
          />
        )}
        {canViewShipments ? (
          <StatCard
            label="Active shipments"
            value={shipmentSummary.data?.active}
            icon={Package}
            isLoading={shipmentSummary.isLoading}
            hint={
              shipmentSummary.data
                ? `${shipmentSummary.data.inTransit} in transit · ${shipmentSummary.data.delivered} delivered`
                : undefined
            }
          />
        ) : (
          <StatCard label="Active shipments" value={0} icon={Package} hint="Shipments module coming soon" />
        )}
        {canViewDrivers && (
          <StatCard
            label="Available drivers"
            value={driverSummary.data?.available}
            icon={MapPin}
            isLoading={driverSummary.isLoading}
            hint={
              driverSummary.data
                ? `${driverSummary.data.onTrip} on trip · ${driverSummary.data.licenseExpiring + driverSummary.data.licenseExpired} licence ${driverSummary.data.licenseExpiring + driverSummary.data.licenseExpired === 1 ? "alert" : "alerts"}`
                : undefined
            }
          />
        )}
        <StatCard label="Team members" value={memberCount} icon={Building2} />
      </div>

      {canViewReports && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Analytics snapshot
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/reports">
                View reports <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="On-time deliveries"
              value={reportOverview.data ? `${reportOverview.data.delivery.onTimePct}%` : undefined}
              icon={CheckCircle2}
              isLoading={reportOverview.isLoading}
              hint={
                reportOverview.data
                  ? `${reportOverview.data.delivery.delivered} delivered · ${reportOverview.data.delivery.late} late`
                  : undefined
              }
            />
            <StatCard
              label="Delivered (30 days)"
              value={reportOverview.data?.delivery.delivered}
              icon={PackageCheck}
              isLoading={reportOverview.isLoading}
              hint={
                reportOverview.data
                  ? `${reportOverview.data.delivery.avgDelayMinutes}m avg delay`
                  : undefined
              }
            />
            <StatCard
              label="Vehicles active"
              value={
                reportOverview.data
                  ? `${reportOverview.data.vehicles.active} of ${reportOverview.data.vehicles.total}`
                  : undefined
              }
              icon={Truck}
              isLoading={reportOverview.isLoading}
            />
            <StatCard
              label="Drivers available"
              value={
                reportOverview.data
                  ? `${reportOverview.data.drivers.available} of ${reportOverview.data.drivers.total}`
                  : undefined
              }
              icon={MapPin}
              isLoading={reportOverview.isLoading}
            />
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <OnboardingChecklist steps={steps} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-4 text-muted-foreground" />
              Recent activity
            </CardTitle>
            <CardDescription>
              {canViewAudit ? "Latest actions in your organization." : "Only owners and admins can view the audit log."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canViewAudit ? (
              recent.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-9" />
                  ))}
                </div>
              ) : recentEntries.length === 0 ? (
                <EmptyState
                  icon={Activity}
                  title="No activity yet"
                  description="Actions like invites and updates will show up here."
                />
              ) : (
                <div className="space-y-3">
                  {recentEntries.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start justify-between gap-3 border-b pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{entry.user.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="uppercase">{entry.action.replace(/_/g, " ")}</span>
                          {" · "}
                          <span className="capitalize">{entry.resource}</span>
                        </p>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {new Date(entry.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/settings/audit-log">View full audit log</Link>
                  </Button>
                </div>
              )
            ) : (
              <EmptyState
                icon={Activity}
                title="Audit log is restricted"
                description="Ask an owner or admin for the full history."
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
