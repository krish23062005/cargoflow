import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

export default async function OnboardingPage() {
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) {
    redirect("/sign-in");
  }

  const organizations = await auth.api.listOrganizations({
    headers: requestHeaders,
  });

  if (organizations.length > 0) {
    if (!session.session.activeOrganizationId) {
      await auth.api.setActiveOrganization({
        headers: requestHeaders,
        body: { organizationId: organizations[0].id },
      });
    }
    redirect("/dashboard");
  }

  redirect("/onboarding/create-org");
}
