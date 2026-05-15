import type { UserRole } from "@/lib/schemas/user-role";

/**
 * Public.user_info — SRS §4.1 (name, business name, phone, email, location / trade).
 * `id` matches auth.users.id.
 */
export type UserInfoRow = {
  id: string;
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  trade: string | null;
  materials_markup_percent: number | null;
  /** CAD rate; db/labour_rates.sql */
  default_labour_rate: number | string | null;
  default_labour_rate_unit: string | null;
  /** db/user_info_roles.sql — admin bypasses billing blocks and AI caps in app layer. */
  role: UserRole;
  created_at: string;
  updated_at: string;
};
