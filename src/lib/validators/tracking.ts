import { z } from "zod";

export const trackingPointSchema = z.object({
  vehicleId: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speedKmh: z.number().nonnegative().max(400).optional().nullable(),
  headingDeg: z.number().min(0).max(360).optional().nullable(),
  accuracyM: z.number().nonnegative().max(10000).optional().nullable(),
  source: z.string().trim().max(20).optional().default("PWA"),
  recordedAt: z.coerce.date().optional(),
});

export type TrackingPointInput = z.infer<typeof trackingPointSchema>;

/**
 * Driver PWA updates arrive in batches (smart intervals — see server). Limit
 * to 100 points per request to protect the ingest endpoint.
 */
export const batchTrackingSchema = z.object({
  points: z.array(trackingPointSchema).min(1).max(100),
});

export type BatchTrackingInput = z.infer<typeof batchTrackingSchema>;

/** Latest position query: probably wants the last N readings per vehicle. */
export const liveTrackingSchema = z.object({
  includeInactive: z.boolean().optional().default(true),
});

export type LiveTrackingInput = z.infer<typeof liveTrackingSchema>;

export const trackingHistorySchema = z.object({
  vehicleId: z.string().min(1),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.number().int().min(1).max(500).optional().default(200),
});

export type TrackingHistoryInput = z.infer<typeof trackingHistorySchema>;