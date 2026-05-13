import { z } from "zod";

export const onboardingBusinessBodySchema = z
  .object({
    businessName: z.string().min(1).max(255),
    ownerName: z.string().min(1).max(255),
    phone: z.string().min(1).max(40),
    email: z.email(),
    city: z.string().min(1).max(100),
    province: z.string().min(1).max(40),
    tradeType: z.string().min(1).max(100),
    hstNumber: z.string().max(80).optional(),
  })
  .strict();

export type OnboardingBusinessBody = z.infer<typeof onboardingBusinessBodySchema>;
