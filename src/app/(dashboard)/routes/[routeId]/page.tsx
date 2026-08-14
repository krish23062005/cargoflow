import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/constants/permissions";
import { RouteDetail } from "@/components/routes/route-detail";

export const metadata = {
  title: "Route",
};

export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ routeId: string }>;
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

  if (!hasPermission(myRole, "route.view")) {
    redirect("/dashboard");
  }

  const { routeId } = await params;

  return (
    <RouteDetail
      routeId={routeId}
      canManage={hasPermission(myRole, "route.manage")}
    />
  );
}