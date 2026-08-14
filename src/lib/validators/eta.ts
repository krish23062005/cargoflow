import { z } from "zod";

export const shipmentEtaSchema = z.object({
  shipmentId: z.string().min(1),
});

export type ShipmentEtaInput = z.infer<typeof shipmentEtaSchema>;

export const etaHistorySchema = z.object({
  shipmentId: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export type EtaHistoryInput = z.infer<typeof etaHistorySchema>;