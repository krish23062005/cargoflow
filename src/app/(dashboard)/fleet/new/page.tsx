import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/constants/permissions";
import { VehicleForm } from "@/components/fleet/vehicle-form";

export const metadata = {
  title: "Add vehicle",
};

export default async function NewVehiclePage() {
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

  if (!hasPermission(myRole, "fleet.manage")) {
    redirect("/fleet");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/fleet"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to fleet
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add a vehicle</h1>
        <p className="text-sm text-muted-foreground">
          Register a new vehicle in {activeOrg.name}&apos;s fleet.
        </p>
      </div>

      <VehicleForm />
    </div>
  );
}
