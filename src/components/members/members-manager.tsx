"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Crown,
  Link2,
  Check,
  Copy,
  Loader2,
  Mail,
  Plus,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/trpc/client";
import { ORG_ROLES, canManageRole, type OrgRole } from "@/lib/constants/permissions";
import {
  inviteMemberSchema,
  type InviteMemberInput,
} from "@/lib/validators/member";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const ROLE_STYLES: Record<string, string> = {
  owner: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  admin: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  dispatcher: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  viewer: "bg-muted text-muted-foreground",
  driver: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export function MembersManager({
  myRole,
  canManage,
}: {
  myRole: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const utils = api.useUtils();

  const membersQuery = api.member.list.useQuery();
  const invitationsQuery = api.member.listInvitations.useQuery();
  const inviteMutation = api.member.invite.useMutation();
  const updateRoleMutation = api.member.updateRole.useMutation();
  const removeMutation = api.member.remove.useMutation();
  const cancelInvitationMutation = api.member.cancelInvitation.useMutation();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [roleBusy, setRoleBusy] = useState<string | null>(null);
  const [shareLink, setShareLink] = useState<{ email: string; url: string } | null>(null);
  const [copied, setCopied] = useState<{ id: string; copied: boolean } | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: "", role: "viewer" },
  });

  function inviteUrlFor(invitationId: string) {
    const base = window.location.origin;
    return `${base}/onboarding/accept-invitation?invitationId=${encodeURIComponent(invitationId)}`;
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function copyInviteLink(invitationId: string) {
    const ok = await copyText(inviteUrlFor(invitationId));
    if (ok) {
      toast.success("Invite link copied");
      setCopied({ id: invitationId, copied: true });
      setTimeout(() => setCopied(null), 2000);
    } else {
      toast.error("Could not copy the link");
    }
  }

  async function onInvite(values: InviteMemberInput) {
    setInviting(true);
    try {
      const result = await inviteMutation.mutateAsync(values);

      if (!result) return;

      setInviteOpen(false);
      reset();
      void utils.member.listInvitations.invalidate();

      if (result.emailDelivered) {
        toast.success(`Invitation sent to ${values.email}`);
      } else {
        // Email failed or dev mode (no Resend key): surface a shareable link.
        setShareLink({ email: values.email, url: result.inviteUrl });
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to send the invitation";
      toast.error(message);
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(memberId: string, role: OrgRole) {
    if (role === membersQuery.data?.members.find((m) => m.id === memberId)?.role) return;
    setRoleBusy(memberId);
    await updateRoleMutation.mutateAsync({ memberId, role });
    setRoleBusy(null);

    toast.success("Role updated");
    void utils.member.list.invalidate();
    router.refresh();
  }

  async function removeMember(memberId: string) {
    setRemoving(true);
    await removeMutation.mutateAsync({ memberId });
    setRemoving(false);

    toast.success("Member removed");
    setRemoveTarget(null);
    void utils.member.list.invalidate();
  }

  async function cancelInvitation(invitationId: string) {
    await cancelInvitationMutation.mutateAsync({ invitationId });
    toast.success("Invitation cancelled");
    void utils.member.listInvitations.invalidate();
  }

  if (membersQuery.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const members = membersQuery.data?.members ?? [];
  const invitations = invitationsQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {members.length} member{members.length === 1 ? "" : "s"} ·{" "}
          {invitations.length} pending invitation
          {invitations.length === 1 ? "" : "s"}
        </p>
        {canManage && (
          <Button onClick={() => setInviteOpen(true)}>
            <Plus />
            Invite member
          </Button>
        )}
      </div>

      {!canManage && (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <ShieldAlert className="size-4" />
          You need an owner or admin role to invite members and change roles.
        </div>
      )}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Joined</TableHead>
              {canManage && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  No members yet.
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarImage src={member.user.image ?? undefined} alt={member.user.name} />
                        <AvatarFallback>
                          {member.user.name?.slice(0, 2).toUpperCase() ?? "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 truncate font-medium">
                          {member.user.name}
                          {member.role === "owner" && (
                            <Crown className="size-3.5 text-amber-500" />
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {canManage && member.role !== "owner" ? (
                      <Select
                        value={member.role}
                        onValueChange={(role) => changeRole(member.id, role as OrgRole)}
                        disabled={roleBusy === member.id || !canManageRole(myRole, member.role)}
                      >
                        <SelectTrigger size="sm" className="w-36">
                          {roleBusy === member.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <SelectValue />
                          )}
                        </SelectTrigger>
                        <SelectContent>
                          {ORG_ROLES.filter(
                            (r) => r.value !== "owner" && canManageRole(myRole, r.value),
                          ).map((r) => (
                            <SelectItem key={r.value} value={r.value}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={ROLE_STYLES[member.role]}>
                        {member.role}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(member.createdAt).toLocaleDateString()}
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={member.role === "owner"}
                        onClick={() => setRemoveTarget(member.id)}
                        aria-label={`Remove ${member.user.name}`}
                      >
                        <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {invitations.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-medium">Pending invitations</h2>
          <div className="rounded-lg border">
            <Table>
              <TableBody>
                {invitations.map((invitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-full bg-muted">
                          <Mail className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{invitation.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Invited as {invitation.role}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyInviteLink(invitation.id)}
                          title="Copy invite link"
                        >
                          {copied?.id === invitation.id && copied.copied ? (
                            <Check className="size-4" />
                          ) : (
                            <Link2 className="size-4" />
                          )}
                          {copied?.id === invitation.id && copied.copied
                            ? "Copied"
                            : "Copy link"}
                        </Button>
                        {canManage && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelInvitation(invitation.id)}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invite a member</DialogTitle>
            <DialogDescription>
              They&apos;ll receive an email with a link to join your organization.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onInvite)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="driver@example.com"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                defaultValue="viewer"
                onValueChange={(v) => setValue("role", v as InviteMemberInput["role"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_ROLES.filter(
                    (r) => r.value !== "owner" && canManageRole(myRole, r.value),
                  ).map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <span className="flex items-center gap-2">
                        {r.label}
                        <span className="text-xs text-muted-foreground">{r.description}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setInviteOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2 className="animate-spin" />}
                Send invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={shareLink !== null} onOpenChange={(open) => !open && setShareLink(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invitation ready</DialogTitle>
            <DialogDescription>
              Email sending isn&apos;t configured (no <code>RESEND_API_KEY</code>), so the
              invitation email was logged to the server instead. Share this link with
              {shareLink ? ` ${shareLink.email}` : " the invitee"} to let them join.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-muted p-3">
              <p className="break-all text-sm">{shareLink?.url}</p>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={async () => {
                  if (!shareLink) return;
                  const ok = await copyText(shareLink.url);
                  if (ok) {
                    toast.success("Invite link copied");
                  } else {
                    toast.error("Could not copy the link");
                  }
                }}
              >
                <Copy />
                Copy link
              </Button>
              <Button variant="outline" onClick={() => setShareLink(null)}>
                Done
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove member</DialogTitle>
            <DialogDescription>
              This member will immediately lose access to the organization. This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveTarget(null)}
              disabled={removing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removing || !removeTarget}
              onClick={() => removeTarget && removeMember(removeTarget)}
            >
              {removing && <Loader2 className="animate-spin" />}
              Remove member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
