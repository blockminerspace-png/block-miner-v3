import { z } from "zod";

/** Max slot index for legacy rack retrieve path (matches vaultController). */
const RACK_SLOT_INDEX_MAX = 79;

export const moveToVaultBodySchema = z
  .object({
    source: z.enum(["inventory", "rack"]),
    itemId: z.coerce.number().int().positive()
  })
  .strict();

export const retrieveFromVaultBodySchema = z.discriminatedUnion("destination", [
  z
    .object({
      destination: z.literal("inventory"),
      vaultId: z.coerce.number().int().positive()
    })
    .strict(),
  z
    .object({
      destination: z.literal("rack"),
      vaultId: z.coerce.number().int().positive(),
      slotIndex: z.coerce.number().int().min(0).max(RACK_SLOT_INDEX_MAX)
    })
    .strict()
]);
