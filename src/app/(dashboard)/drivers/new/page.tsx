import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/constants/permissions";
import { DriverForm } from "@/components/drivers/driver-form";

export const metadata = {
  title: "Add driver",
};

export default async function NewDriverPage() {
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

  if (!hasPermission(myRole, "driver.manage")) {
    redirect("/drivers");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/drivers"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to drivers
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add a driver</h1>
        <p className="text-sm text-muted-foreground">
          Register a new driver in {activeOrg.name}&apos;s team.
        </p>
      </div>

      <DriverForm />
    </div>
  );
}
