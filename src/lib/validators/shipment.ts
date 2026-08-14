import { z } from "zod";
import { SHIPMENT_STATUSES, CARGO_TYPES, SHIPMENT_EVENT_TYPES } from "@/lib/constants/shipments";

export const createShipmentSchema = z.object({
  customerName: z.string().trim().min(2, "Customer name is required").max(120),
  customerPhone: z.string().trim().max(30).optional().nullable(),
  customerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email address")
    .optional()
    .nullable(),
  originAddress: z.string().trim().min(3, "Origin address is required").max(200),
  originCity: z.string().trim().max(100).optional().nullable(),
  originLat: z.number().min(-90).max(90).optional().nullable(),
  originLng: z.number().min(-180).max(180).optional().nullable(),
  destinationAddress: z
    .string()
    .trim()
    .min(3, "Destination address is required")
    .max(200),
  destinationCity: z.string().trim().max(100).optional().nullable(),
  destinationLat: z.number().min(-90).max(90).optional().nullable(),
  destinationLng: z.number().min(-180).max(180).optional().nullable(),
  cargoType: z.enum(CARGO_TYPES).default("GENERAL"),
  cargoDescription: z.string().trim().max(1000).optional().nullable(),
  weightKg: z.number().positive("Weight must be positive").optional().nullable(),
  dimensions: z.string().trim().max(50).optional().nullable(),
  declaredValue: z.number().nonnegative("Value must be zero or greater").optional().nullable(),
  requestedPickupAt: z.coerce.date().optional().nullable(),
  estimatedDeliverAt: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  routeId: z.string().min(1).optional().nullable(),
});

export type CreateShipmentInput = z.infer<typeof createShipmentSchema>;

export const updateShipmentSchema = createShipmentSchema.partial().extend({
  id: z.string().min(1),
});

export type UpdateShipmentInput = z.infer<typeof updateShipmentSchema>;

export const updateShipmentStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(SHIPMENT_STATUSES),
});

export type UpdateShipmentStatusInput = z.infer<typeof updateShipmentStatusSchema>;

export const assignShipmentSchema = z.object({
  id: z.string().min(1),
  assignmentId: z.string().min(1, "Select a vehicle–driver assignment"),
});

export type AssignShipmentInput = z.infer<typeof assignShipmentSchema>;

export const addShipmentEventSchema = z.object({
  id: z.string().min(1),
  eventType: z.enum(SHIPMENT_EVENT_TYPES).default("NOTE"),
  description: z.string().trim().min(2, "Description is required").max(500),
  location: z.string().trim().max(200).optional().nullable(),
  latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(),
});

export type AddShipmentEventInput = z.infer<typeof addShipmentEventSchema>;

export const listShipmentsSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional().nullable(),
  status: z.string().optional().nullable(),
});

export type ListShipmentsInput = z.infer<typeof listShipmentsSchema>;

export const shipmentIdSchema = z.object({
  id: z.string().min(1),
});

export type ShipmentIdInput = z.infer<typeof shipmentIdSchema>;