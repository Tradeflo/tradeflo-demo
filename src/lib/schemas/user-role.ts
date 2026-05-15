import { z } from "zod";

export const USER_ROLE_VALUES = ["contractor", "admin"] as const;

export type UserRole = (typeof USER_ROLE_VALUES)[number];

export const userRoleSchema = z.enum(USER_ROLE_VALUES);
