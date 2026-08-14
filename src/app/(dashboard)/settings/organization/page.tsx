import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { OrganizationSettingsForm } from "@/components/org/organization-settings-form";
import { SettingsNav } from "@/components/layout/settings-nav";

export const metadata = {
  title: "Organization settings",
};

export default async function OrganizationSettingsPage() {
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

  const role =
    activeOrg.members.find((m) => m.userId === session.user!.id)?.role ?? "viewer";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SettingsNav myRole={role} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Organization settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your workspace profile, location and defaults.
        </p>
      </div>

      <OrganizationSettingsForm organization={activeOrg} role={role} />
    </div>
  );
}
