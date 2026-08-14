import { z } from "zod";

export const podPhotoSchema = z.object({
  dataUrl: z
    .string()
    .startsWith("data:", "Photo must be a valid data URL")
    .max(2_000_000, "Photo is too large (max ~1.5 MB after compression)"),
  contentType: z
    .string()
    .regex(/^image\/(jpeg|png|webp)$/, "Photo must be JPEG, PNG or WebP"),
});

export const createPodSchema = z.object({
  shipmentId: z.string().min(1),
  recipientName: z.string().trim().min(1, "Recipient name is required").max(120),
  recipientPhone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  photos: z.array(podPhotoSchema).max(4, "At most 4 photos allowed"),
  signature: z
    .string()
    .startsWith("data:", "Signature must be a data URL")
    .max(500_000, "Signature is too large")
    .optional()
    .nullable(),
  locationLat: z.number().min(-90).max(90).optional().nullable(),
  locationLng: z.number().min(-180).max(180).optional().nullable(),
});

export const getPodForShipmentSchema = z.object({
  shipmentId: z.string().min(1),
});

export type CreatePodInput = z.infer<typeof createPodSchema>;
export type PodPhoto = z.infer<typeof podPhotoSchema>;