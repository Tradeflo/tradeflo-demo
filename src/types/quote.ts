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
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
