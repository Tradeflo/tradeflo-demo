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
  created_at: string;
  updated_at: string;
};
