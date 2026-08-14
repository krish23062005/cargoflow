import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/constants/permissions";
import { RouteList } from "@/components/routes/route-list";

export const metadata = {
  title: "Routes",
};

export default async function RoutesPage() {
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Routes</h1>
        <p className="text-sm text-muted-foreground">
          Plan and save reusable route templates for {activeOrg.name}.
        </p>
      </div>

      <RouteList canManage={hasPermission(myRole, "route.manage")} />
    </div>
  );
}