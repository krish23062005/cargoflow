import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/constants/permissions";
import { ShipmentList } from "@/components/shipments/shipment-list";

export const metadata = {
  title: "Shipments",
};

export default async function ShipmentsPage() {
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

  if (!hasPermission(myRole, "shipment.view")) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shipments</h1>
        <p className="text-sm text-muted-foreground">
          Track cargo moving through {activeOrg.name}.
        </p>
      </div>

      <ShipmentList canManage={hasPermission(myRole, "shipment.create")} />
    </div>
  );
}