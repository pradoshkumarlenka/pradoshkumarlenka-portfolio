"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/supabase/config";
import { ACT_COOKIE, GRANT_COOKIE, GRANT_MS, IDLE_MS, TAB_COOKIE, activityToken, cookieOptions, grantToken } from "./session-policy";

export type LoginState = { step: "email" | "code"; message?: string; error?: string };

const SENT = "If this email is authorised, a sign-in email is on its way. Open the link in it, or enter its code below.";

/**
 * Step 1 — request a sign-in email (Supabase email OTP / magic link).
 * Only the configured administrator address is ever sent an email; any other
 * address gets the same neutral reply (no account probing, no wasted emails).
 * shouldCreateUser: false — sign-ups stay impossible from here.
 */
export async function requestSignIn(_: LoginState, form: FormData): Promise<LoginState> {
  if (!supabaseConfigured) return { step: "email", error: "Sign-in is not configured on this deployment." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { step: "email", error: "Enter a valid email address." };
  const admin = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (!admin || email !== admin) return { step: "code", message: SENT };

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` } });
  if (error?.code === "over_email_send_rate_limit") return { step: "email", error: "Too many emails were sent recently. Please wait a while and try again." };
  if (error) return { step: "email", error: "The sign-in email could not be sent. Please try again later." };
  return { step: "code", message: SENT };
}

/** Step 2 (optional) — enter the 6-digit code from the email instead of clicking the link. */
export async function verifyCode(_: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const token = String(form.get("code") ?? "").replace(/\D/g, "");
  if (token.length < 6) return { step: "code", error: "Enter the code from the email." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error || !data.user) return { step: "code", error: "That code is not valid or has expired." };
  // Fresh idle timer + a one-time grant for THIS tab (the one that typed the code).
  const [act, grant] = await Promise.all([activityToken(data.user.id), grantToken(data.user.id)]);
  if (!act || !grant) return { step: "code", error: "Sign-in is not fully configured on this deployment." };
  const jar = await cookies();
  jar.set(ACT_COOKIE, act, cookieOptions(IDLE_MS));
  jar.set(GRANT_COOKIE, grant, cookieOptions(GRANT_MS));
  jar.delete(TAB_COOKIE);
  redirect("/admin");
}
