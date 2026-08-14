import { z } from "zod";
import { DRIVER_STATUSES, BLOOD_TYPES } from "@/lib/constants/drivers";

/**
 * Matches E.164-style numbers for common African country calling codes:
 * +234 (NG), +254 (KE), +233 (GH), +27 (ZA), +255 (TZ), +256 (UG), +250 (RW),
 * +251 (ET), +260 (ZM), +263 (ZW), +20 (EG), +212 (MA), +218 (LY), etc.
 */
const AFRICAN_PHONE_REGEX =
  /^\+?(20|211|212|213|216|218|220|221|222|223|224|225|226|227|228|229|230|231|232|233|234|237|240|241|242|243|244|245|249|250|251|252|253|254|255|256|257|258|260|261|263|264|265|266|267|268|269|291)\d{7,11}$/;

const phoneSchema = z
  .string()
  .trim()
  .regex(AFRICAN_PHONE_REGEX, "Enter a valid African phone number, e.g. +2348012345678");

const driverStatusSchema = z.enum(DRIVER_STATUSES);

export const createDriverSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  phone: phoneSchema,
  email: z.string().trim().toLowerCase().email("Enter a valid email address").optional().nullable(),
  licenseNumber: z.string().trim().toUpperCase().min(4, "License number is required").max(30),
  licenseClass: z.string().trim().toUpperCase().max(10).optional().nullable(),
  licenseExpiry: z.coerce.date(),
  status: driverStatusSchema.default("AVAILABLE"),
  bloodType: z.enum(BLOOD_TYPES).optional().nullable(),
  emergencyContact: z.string().trim().max(80).optional().nullable(),
  nextOfKinName: z.string().trim().max(80).optional().nullable(),
  nextOfKinPhone: phoneSchema.optional().nullable(),
  address: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  pin: z
    .string()
    .regex(/^\d{4,8}$/, "PIN must be 4–8 digits")
    .optional()
    .nullable(),
});

export type CreateDriverInput = z.infer<typeof createDriverSchema>;

export const updateDriverSchema = createDriverSchema.partial().extend({
  id: z.string().min(1),
});

export type UpdateDriverInput = z.infer<typeof updateDriverSchema>;

export const archiveDriverSchema = z.object({
  id: z.string().min(1),
});

export type ArchiveDriverInput = z.infer<typeof archiveDriverSchema>;

export const listDriversSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(100).optional().nullable(),
  status: z.string().optional().nullable(),
  licenseStatus: z.enum(["VALID", "EXPIRING", "EXPIRED"]).optional().nullable(),
});

export type ListDriversInput = z.infer<typeof listDriversSchema>;

export const driverIdSchema = z.object({
  id: z.string().min(1),
});

export type DriverIdInput = z.infer<typeof driverIdSchema>;
