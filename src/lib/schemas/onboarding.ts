import { z } from "zod";

/** Matches `db/labour_rates.sql` `default_labour_rate_unit`. */
export const onboardingLabourRateUnitSchema = z.enum(["hour", "day", "flat"]);

export const onboardingBusinessBodySchema = z
  .object({
    businessName: z.string().min(1).max(255),
    ownerName: z.string().min(1).max(255),
    phone: z.string().min(1).max(40),
    email: z.email(),
    city: z.string().min(1).max(100),
    province: z.string().min(1).max(40),
    tradeType: z.string().min(1).max(100),
    materialsMarkupPercent: z
      .number()
      .min(0, "Markup must be at least 0")
      .max(500, "Markup cannot exceed 500%"),
    defaultLabourRate: z
      .number()
      .positive("Enter a default labour rate greater than zero")
      .max(99_999_999.99, "Rate is too large"),
    defaultLabourRateUnit: onboardingLabourRateUnitSchema,
    hstNumber: z.string().max(80).optional(),
  })
  .strict();

export type OnboardingBusinessBody = z.infer<typeof onboardingBusinessBodySchema>;
