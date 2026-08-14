import { z } from "zod";
import { ROLE_HIERARCHY, type OrgRole } from "@/lib/constants/permissions";

export const ORG_ROLE_VALUES = ROLE_HIERARCHY as readonly string[];

const roleSchema = z.enum(ROLE_HIERARCHY);

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  role: roleSchema,
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateRoleSchema = z.object({
  memberId: z.string().min(1),
  role: roleSchema,
});

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export const removeMemberSchema = z.object({
  memberId: z.string().min(1),
});

export type RemoveMemberInput = z.infer<typeof removeMemberSchema>;

export const cancelInvitationSchema = z.object({
  invitationId: z.string().min(1),
});

export type CancelInvitationInput = z.infer<typeof cancelInvitationSchema>;

export const getInvitationSchema = z.object({
  invitationId: z.string().min(1),
});

export type GetInvitationInput = z.infer<typeof getInvitationSchema>;

export const listAuditLogsSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(50).optional(),
  action: z.string().optional().nullable(),
  resource: z.string().optional().nullable(),
  search: z.string().trim().max(100).optional().nullable(),
});

export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>;

export type { OrgRole };
