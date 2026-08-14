import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { isRoleAtLeast } from "@/lib/constants/permissions";
import { MembersManager } from "@/components/members/members-manager";
import { SettingsNav } from "@/components/layout/settings-nav";

export const metadata = {
  title: "Members",
};

export default async function MembersSettingsPage() {
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
    <div className="mx-auto max-w-5xl space-y-6">
      <SettingsNav myRole={myRole} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-sm text-muted-foreground">
          Invite teammates and manage their roles in {activeOrg.name}.
        </p>
      </div>

      <MembersManager
        myRole={myRole}
        canManage={isRoleAtLeast(myRole, "admin")}
      />
    </div>
  );
}
