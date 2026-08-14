import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasPermission, isRoleAtLeast } from "@/lib/constants/permissions";
import { DashboardHome } from "@/components/dashboard/dashboard-home";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session?.user) {
    redirect("/sign-in");
  }

  const activeOrganizationId = session.session.activeOrganizationId;
  if (!activeOrganizationId) {
    redirect("/onboarding");
  }

  const activeOrg = await auth.api.getFullOrganization({
    headers: await headers(),
    query: { organizationId: activeOrganizationId },
  });
  if (!activeOrg) {
    redirect("/onboarding");
  }

  const myRole =
    activeOrg.members.find((m) => m.userId === session.user!.id)?.role ?? "viewer";

  return (
    <DashboardHome
      organizationName={activeOrg.name}
      memberCount={activeOrg.members.length}
      canViewAudit={isRoleAtLeast(myRole, "admin")}
      canViewFleet={hasPermission(myRole, "fleet.view")}
      canViewDrivers={hasPermission(myRole, "driver.view")}
      canViewShipments={hasPermission(myRole, "shipment.view")}
      canViewReports={hasPermission(myRole, "report.view")}
    />
  );
}
