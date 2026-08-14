import { z } from "zod";
import { VEHICLE_TYPES, VEHICLE_STATUSES } from "@/lib/constants/vehicles";

const vehicleTypeSchema = z.enum(VEHICLE_TYPES);
const vehicleStatusSchema = z.enum(VEHICLE_STATUSES);

export const createVehicleSchema = z.object({
  plateNumber: z
    .string()
    .trim()
    .toUpperCase()
    .min(3, "Plate number is required")
    .max(20, "Plate number is too long"),
  make: z.string().trim().min(2, "Make is required").max(50),
  model: z.string().trim().min(1, "Model is required").max(50),
  year: z
    .number()
    .int()
    .min(1980, "Year must be 1980 or later")
    .max(new Date().getFullYear() + 1, "Year cannot be in the future"),
  type: vehicleTypeSchema.default("TRUCK"),
  status: vehicleStatusSchema.default("AVAILABLE"),
  color: z.string().trim().max(30).optional().nullable(),
  vin: z.string().trim().max(30).optional().nullable(),
  fuelType: z.string().trim().max(20).optional().nullable(),
  fuelCapacity: z.number().positive("Capacity must be positive").optional().nullable(),
  insuranceCompany: z.string().trim().max(60).optional().nullable(),
  insuranceExpiry: z.coerce.date().optional().nullable(),
  lastServiceAt: z.coerce.date().optional().nullable(),
  nextServiceAt: z.coerce.date().optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
});

export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = createVehicleSchema.partial().extend({
  id: z.string().min(1),
});

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const archiveVehicleSchema = z.object({
  id: z.string().min(1),
});

export type ArchiveVehicleInput = z.infer<typeof archiveVehicleSchema>;

export const listVehiclesSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional().nullable(),
  type: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
});

export type ListVehiclesInput = z.infer<typeof listVehiclesSchema>;

export const vehicleIdSchema = z.object({
  id: z.string().min(1),
});

export type VehicleIdInput = z.infer<typeof vehicleIdSchema>;
