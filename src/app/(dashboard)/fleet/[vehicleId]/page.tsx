import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/constants/permissions";
import { VehicleDetail } from "@/components/fleet/vehicle-detail";

export const metadata = {
  title: "Vehicle",
};

export default async function VehicleDetailPage({
  params,
}: {
  params: Promise<{ vehicleId: string }>;
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

  if (!hasPermission(myRole, "fleet.view")) {
    redirect("/dashboard");
  }

  const { vehicleId } = await params;

  return (
    <VehicleDetail
      vehicleId={vehicleId}
      canManage={hasPermission(myRole, "fleet.manage")}
    />
  );
}
