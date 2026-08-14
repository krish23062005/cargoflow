import { z } from "zod";
import { WAYPOINT_TYPES } from "@/lib/constants/routes";

export const waypointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  name: z.string().trim().max(120).optional().nullable(),
  type: z.enum(WAYPOINT_TYPES),
});

export type Waypoint = z.infer<typeof waypointSchema>;

export const createRouteSchema = z.object({
  name: z.string().trim().min(2, "Route name is required").max(120),
  waypoints: z
    .array(waypointSchema)
    .min(2, "Add at least a pickup and a dropoff point")
    .max(50, "A route can have at most 50 waypoints"),
  totalDistanceKm: z.number().nonnegative().optional().nullable(),
  estimatedDurationMin: z.number().int().nonnegative().optional().nullable(),
  geometry: z.array(z.tuple([z.number(), z.number()])).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export type CreateRouteInput = z.infer<typeof createRouteSchema>;

export const updateRouteSchema = createRouteSchema.partial().extend({
  id: z.string().min(1),
});

export type UpdateRouteInput = z.infer<typeof updateRouteSchema>;

export const listRoutesSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional().nullable(),
});

export type ListRoutesInput = z.infer<typeof listRoutesSchema>;

export const routeIdSchema = z.object({
  id: z.string().min(1),
});

export type RouteIdInput = z.infer<typeof routeIdSchema>;

export const calculateRouteSchema = z.object({
  waypoints: z.array(waypointSchema).min(2).max(50),
});

export type CalculateRouteInput = z.infer<typeof calculateRouteSchema>;

export const linkRouteSchema = z.object({
  id: z.string().min(1),
  shipmentId: z.string().min(1).nullable(),
});

export type LinkRouteInput = z.infer<typeof linkRouteSchema>;