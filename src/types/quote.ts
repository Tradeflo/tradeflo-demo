/** Row shape for `public.quotes` (Milestone 1). */
export type QuoteRow = {
  id: string;
  user_id: string;
  status: string;
  title: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
};

/** Row shape for `public.quote_versions`. */
export type QuoteVersionRow = {
  id: string;
  quote_id: string;
  version_number: number;
  status: string;
  payload: Record<string, unknown>;
  sent_at: string | null;
  approval_token: string | null;
  approval_token_expires_at: string | null;
  approval_token_consumed_at: string | null;
  created_at: string;
  updated_at: string;
};
