import { z } from "zod";

export const approveActionBodySchema = z
  .object({
    action: z.enum(["approve", "request_changes"]),
    message: z.string().max(4000).optional(),
  })
  .strict();

export type ApproveActionBody = z.infer<typeof approveActionBodySchema>;
