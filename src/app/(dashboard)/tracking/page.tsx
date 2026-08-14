import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/constants/permissions";
import { TrackingView } from "@/components/tracking/tracking-view";

export const metadata = {
  title: "Live tracking",
};

export const dynamic = "force-dynamic";

export default async function TrackingPage() {
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

  if (!hasPermission(myRole, "tracking.view")) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Live tracking</h1>
        <p className="text-sm text-muted-foreground">
          Where the {activeOrg.name} fleet is right now.
        </p>
      </div>

      <TrackingView />
    </div>
  );
}