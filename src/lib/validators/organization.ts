import { z } from "zod";

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createOrgSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Organization name must be at least 2 characters")
    .max(100, "Organization name must be at most 100 characters"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(SLUG_REGEX, "Slug may only contain lowercase letters, numbers and hyphens")
    .min(2, "Slug must be at least 2 characters")
    .max(50, "Slug must be at most 50 characters")
    .optional(),
  country: z.string().min(2, "Please select a country"),
  currency: z.string().length(3, "Please select a currency"),
  timezone: z.string().min(1, "Please select a timezone"),
  industry: z.string().trim().max(100).optional(),
});

export type CreateOrgInput = z.infer<typeof createOrgSchema>;

export const updateOrgSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Organization name must be at least 2 characters")
      .max(100)
      .optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(SLUG_REGEX, "Slug may only contain lowercase letters, numbers and hyphens")
      .min(2)
      .max(50)
      .optional(),
    logo: z.string().url("Logo must be a valid URL").nullable().optional(),
    country: z.string().min(2).optional(),
    currency: z.string().length(3).optional(),
    timezone: z.string().min(1).optional(),
    industry: z.string().trim().max(100).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Nothing to update",
  });

export type UpdateOrgInput = z.infer<typeof updateOrgSchema>;

export const setActiveOrgSchema = z.object({
  organizationId: z.string().min(1),
});
