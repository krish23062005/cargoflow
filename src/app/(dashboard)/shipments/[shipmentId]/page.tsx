import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/constants/permissions";
import { ShipmentDetail } from "@/components/shipments/shipment-detail";

export const metadata = {
  title: "Shipment",
};

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ shipmentId: string }>;
}) {
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

  const { shipmentId } = await params;

  return (
    <ShipmentDetail
      shipmentId={shipmentId}
      canManage={hasPermission(myRole, "shipment.create")}
      canUpdateStatus={hasPermission(myRole, "shipment.update_status")}
    />
  );
}