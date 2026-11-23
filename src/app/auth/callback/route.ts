import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { ACT_COOKIE, GRANT_COOKIE, GRANT_MS, IDLE_MS, TAB_COOKIE, activityToken, cookieOptions, grantToken } from "@/lib/admin/session-policy";

/**
 * Finishes an email sign-in link. Supports both link styles Supabase sends:
 *   ?code=…                       (PKCE: exchanged with the verifier cookie set at sign-in)
 *   ?token_hash=…&type=magiclink  (token-hash links)
 * On success → /admin (which still checks is_admin) with a fresh idle timer and a
 * one-time grant that only the tab finishing this sign-in can claim. On failure → login.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const supabase = await createClient();
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  let userId: string | undefined;
  if (code) userId = (await supabase.auth.exchangeCodeForSession(code)).data.session?.user.id;
  else if (tokenHash && type) userId = (await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).data.user?.id;

  const [act, grant] = userId ? await Promise.all([activityToken(userId), grantToken(userId)]) : [null, null];
  if (!userId || !act || !grant) return NextResponse.redirect(new URL("/admin/login?error=link", origin));
  const res = NextResponse.redirect(new URL("/admin", origin));
  res.cookies.set(ACT_COOKIE, act, cookieOptions(IDLE_MS));
  res.cookies.set(GRANT_COOKIE, grant, cookieOptions(GRANT_MS));
  res.cookies.set(TAB_COOKIE, "", { ...cookieOptions(0), maxAge: 0 }); // any earlier tab loses access
  return res;
}
