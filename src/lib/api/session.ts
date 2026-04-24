import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function getSessionUser(): Promise<{
  user: User | null;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user };
}
