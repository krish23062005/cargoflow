import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import { SettingsNav } from "@/components/layout/settings-nav";

export const metadata = {
  title: "Notification preferences",
};

export default async function NotificationSettingsPage() {
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
    <div className="mx-auto max-w-3xl space-y-6">
      <SettingsNav myRole={myRole} />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Choose which updates you receive, and how they reach you.
        </p>
      </div>

      <NotificationPreferencesForm />
    </div>
  );
}