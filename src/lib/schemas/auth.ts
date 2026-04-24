import { z } from "zod";

export const signupCredentialsSchema = z
  .object({
    email: z.string().email("Enter a valid email"),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters"),
    confirm: z.string(),
  })
  .refine((data) => data.password === data.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export type SignupCredentialsValues = z.infer<typeof signupCredentialsSchema>;

export const loginCredentialsSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export type LoginCredentialsValues = z.infer<typeof loginCredentialsSchema>;
