import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/constants/permissions";
import { ShipmentForm } from "@/components/shipments/shipment-form";

export const metadata = {
  title: "New shipment",
};

export default async function NewShipmentPage() {
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

  if (!hasPermission(myRole, "shipment.create")) {
    redirect("/shipments");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/shipments"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to shipments
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create a shipment</h1>
        <p className="text-sm text-muted-foreground">
          Book cargo from origin to destination and generate a tracking number.
        </p>
      </div>

      <ShipmentForm />
    </div>
  );
}