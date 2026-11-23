import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { ACT_COOKIE, TAB_COOKIE, absoluteExpired, idleLeft, tabProven } from "./session-policy";

export type AdminSession =
  | { status: "unconfigured" }
  | { status: "signed-out"; expired?: boolean }
  | { status: "not-admin"; email: string | null }
  | { status: "admin"; userId: string; email: string }
  /** Valid administrator session, but this request does not come from the tab that holds it. */
  | { status: "locked"; userId: string; email: string };

/**
 * DATA ACCESS LAYER — the single place that decides who is the administrator.
 * 1. getUser() asks Supabase Auth to validate the session (not just decode a cookie).
 * 2. Session limits (src/lib/admin/session-policy.ts): idle timer cookie (signed,
 *    bound to this user) and the absolute limit since the last email sign-in.
 * 3. public.is_admin() asks the database itself (confirmed email + admin list).
 * Memoised per request. The database's row-level security enforces the same
 * rule again on every query, so this is defence in depth, not the only check.
 */
const getAuthenticated = cache(async (): Promise<AdminSession> => {
  if (!supabaseConfigured) return { status: "unconfigured" };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { status: "signed-out" };
  const act = (await cookies()).get(ACT_COOKIE)?.value;
  if (absoluteExpired(data.user.last_sign_in_at) || (await idleLeft(act, data.user.id)) <= 0) return { status: "signed-out", expired: true };
  const { data: isAdmin, error: rpcError } = await supabase.rpc("is_admin");
  if (rpcError || isAdmin !== true) return { status: "not-admin", email: data.user.email ?? null };
  return { status: "admin", userId: data.user.id, email: data.user.email ?? "" };
});

/**
 * The administrator session for THIS request — only if it also proves it comes from the
 * tab that holds the session (src/lib/admin/session-policy.ts: x-admin-tab header added by
 * the admin tab to its fetches, or a draft-preview ticket). Every admin page, server action,
 * route handler, the media route and the draft source go through here, so another tab with
 * the same cookies receives no private data (it gets "locked").
 */
export const getAdminSession = cache(async (): Promise<AdminSession> => {
  const s = await getAuthenticated();
  if (s.status !== "admin") return s;
  const ok = await tabProven(await headers(), (await cookies()).get(TAB_COOKIE)?.value, s.userId);
  return ok ? s : { status: "locked", userId: s.userId, email: s.email };
});

/** Only for /admin/session (the endpoint a tab uses to prove itself): no tab proof required. */
export const getAdminSessionWithoutTab = getAuthenticated;

/** For admin pages: redirects anyone who is not the administrator. */
export async function requireAdminPage() {
  const s = await getAdminSession();
  if (s.status === "signed-out") redirect(s.expired ? "/admin/login?error=expired" : "/admin/login");
  if (s.status === "unconfigured") redirect("/admin/login");
  if (s.status === "not-admin") redirect("/admin/login?error=not-admin");
  if (s.status === "locked") redirect("/admin/unlock");
  return s;
}

/** For Server Actions: throws (never redirects) so a forged request simply fails. */
export async function assertAdmin() {
  const s = await getAdminSession();
  if (s.status !== "admin") throw new Error("Not authorised.");
  return { session: s, supabase: await createClient() };
}
