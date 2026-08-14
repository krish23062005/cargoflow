import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/constants/permissions";
import { RouteBuilder } from "@/components/routes/route-builder";

export const metadata = {
  title: "New route",
};

export default async function NewRoutePage() {
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

  if (!hasPermission(myRole, "route.manage")) {
    redirect("/routes");
  }

  return (
    <div className="mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Plan a new route</h1>
        <p className="text-sm text-muted-foreground">
          Click the map to add waypoints, compute distance and ETAs, then save it as a template.
        </p>
      </div>

      <RouteBuilder />
    </div>
  );
}