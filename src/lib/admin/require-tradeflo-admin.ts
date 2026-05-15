import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api/session";
import { isTradefloAdminUser } from "@/lib/admin/tradeflo-admin";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

export async function requireTradefloAdminUser(): Promise<User> {
  const { user } = await getSessionUser();
  if (!user) {
    redirect("/");
  }
  const supabase = await createClient();
  if (!(await isTradefloAdminUser(supabase, user))) {
    redirect("/");
  }
  return user;
}
