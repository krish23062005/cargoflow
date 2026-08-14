"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { api } from "@/trpc/client";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type AuthSession = NonNullable<
  Awaited<ReturnType<typeof authClient.getSession>>["data"]
>;

function AcceptInvitation() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationId = searchParams.get("invitationId");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  useEffect(() => {
    let active = true;
    authClient
      .getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data);
          setSessionLoading(false);
        }
      })
      .catch(() => {
        if (active) setSessionLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Only fetch invitation details once the invitee is signed in.
  const invitationQuery = api.member.getInvitation.useQuery(
    { invitationId: invitationId ?? "" },
    { enabled: Boolean(invitationId && session?.user) },
  );

  const backToAccept = invitationId
    ? `/onboarding/accept-invitation?invitationId=${encodeURIComponent(invitationId)}`
    : "/onboarding";
  const signUpUrl = `/sign-up?callbackURL=${encodeURIComponent(backToAccept)}`;
  const signInUrl = `/sign-in?callbackURL=${encodeURIComponent(backToAccept)}`;

  async function accept() {
    if (!invitationId) return;
    setLoading(true);
    const { error } = await authClient.organization.acceptInvitation({
      invitationId,
    });
    setLoading(false);

    if (error) {
      toast.error(error.message ?? "Unable to accept invitation");
      return;
    }

    toast.success("Invitation accepted");
    router.push("/dashboard");
    router.refresh();
  }

  if (sessionLoading) {
    return (
      <Card>
        <CardContent className="grid gap-3 py-10">
          <Skeleton className="mx-auto h-10 w-40" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  const signedIn = Boolean(session?.user);

  return (
    <Card>
      <CardHeader className="space-y-1 text-center">
        <div className="mb-2 flex justify-center">
          <Logo />
        </div>
        <CardTitle className="text-2xl">You&apos;ve been invited</CardTitle>
        <CardDescription>
          {invitationId
            ? "A team wants you to join their workspace on CargoFlow."
            : "Missing invitation link. Ask the person who invited you for a fresh link."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {!invitationId ? (
          <p className="text-center text-sm text-destructive">
            Missing invitation link. Ask the person who invited you for a fresh link.
          </p>
        ) : !signedIn ? (
          <>
            <p className="text-center text-sm text-muted-foreground">
              To accept, you&apos;ll need an account with the email address this invitation
              was sent to.
            </p>
            <div className="grid gap-2">
              <Button asChild>
                <Link href={signUpUrl}>Create an account</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href={signInUrl}>I already have an account — sign in</Link>
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              After signing in you&apos;ll be brought back here to accept.
            </p>
          </>
        ) : invitationQuery.isLoading ? (
          <div className="grid gap-3 py-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : invitationQuery.isError ? (
          <>
            <p className="text-center text-sm text-destructive">
              This invitation isn&apos;t available for the account you&apos;re signed in
              with ({session?.user?.email ?? "unknown"}). Make sure you&apos;re signed in
              with the email address the invitation was sent to.
            </p>
            <Button variant="outline" asChild>
              <Link href={signInUrl}>Switch account</Link>
            </Button>
          </>
        ) : invitationQuery.data ? (
          <>
            <div className="space-y-2 rounded-lg border p-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Organization</span>
                <span className="font-medium">{invitationQuery.data.organizationName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Invited as</span>
                <Badge variant="outline">{invitationQuery.data.role}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Invited by</span>
                <span className="font-medium">{invitationQuery.data.inviterEmail}</span>
              </div>
            </div>
            <Button className="w-full" onClick={accept} disabled={loading}>
              {loading ? "Accepting…" : "Accept invitation"}
            </Button>
          </>
        ) : (
          <div className="grid gap-3 py-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AcceptInvitationPage() {
  return (
    <Suspense fallback={null}>
      <AcceptInvitation />
    </Suspense>
  );
}
