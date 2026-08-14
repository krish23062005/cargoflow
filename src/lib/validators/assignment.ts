import { z } from "zod";

export const ASSIGNMENT_STATUSES = ["ACTIVE", "ENDED"] as const;

export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

export const assignDriverSchema = z.object({
  vehicleId: z.string().min(1, "Vehicle is required"),
  driverId: z.string().min(1, "Driver is required"),
  notes: z.string().trim().max(500).optional().nullable(),
});

export type AssignDriverInput = z.infer<typeof assignDriverSchema>;

export const unassignDriverSchema = z.object({
  assignmentId: z.string().min(1),
});

export type UnassignDriverInput = z.infer<typeof unassignDriverSchema>;

export const listAssignmentsSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  status: z.enum(ASSIGNMENT_STATUSES).optional().nullable(),
  vehicleId: z.string().optional().nullable(),
  driverId: z.string().optional().nullable(),
});

export type ListAssignmentsInput = z.infer<typeof listAssignmentsSchema>;

export const assignmentIdSchema = z.object({
  id: z.string().min(1),
});

export type AssignmentIdInput = z.infer<typeof assignmentIdSchema>;
