import { z } from "zod";

export const materialsCatalogPatchSchema = z.object({
  display_name: z.string().min(1).max(500).optional(),
  base_retail_price: z.number().finite().nonnegative().optional(),
  unit: z.union([z.string().max(120), z.literal("")]).optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(999_999).optional(),
});

/** Admin create body (matches public.materials_catalog). */
export const materialsCatalogCreateSchema = z.object({
  trade: z.string().min(1).max(160).trim(),
  material_key: z
    .string()
    .min(1)
    .max(160)
    .trim()
    .regex(
      /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/,
      "Start with alphanumeric; use ._- only otherwise (stable key for imports)",
    ),
  display_name: z.string().min(1).max(500).trim(),
  description: z.union([z.string().max(2000), z.literal("")]).optional(),
  unit: z.union([z.string().max(120), z.literal("")]).optional(),
  base_retail_price: z.number().finite().nonnegative(),
  currency: z
    .string()
    .min(3)
    .max(8)
    .trim()
    .default("CAD"),
  sort_order: z.number().int().min(0).max(999_999).optional().default(0),
  is_active: z.boolean().optional().default(true),
});

export type MaterialsCatalogCreateInput = z.infer<
  typeof materialsCatalogCreateSchema
>;
