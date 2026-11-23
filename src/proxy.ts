import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";
import {
  ACT_COOKIE, IDLE_MS, PASSIVE_HEADER, PV_HEADER, PV_PARAM, SESSION_COOKIES, TAB_COOKIE, TAB_HEADER,
  absoluteExpired, activityToken, cookieOptions, idleLeft, tabMatches,
} from "@/lib/admin/session-policy";

/**
 * PROXY (runs before /admin and /auth routes, and before pages while Draft Mode is on).
 * - Keeps the Supabase session cookie fresh (token refresh).
 * - Sends signed-out visitors to the login page early.
 * - Enforces the admin session limits (idle + absolute, src/lib/admin/session-policy.ts):
 *   an expired session is signed out in Supabase and its cookies are cleared.
 *   Requests from the tab holding the session count as activity (not PASSIVE_HEADER checks).
 * - Tab binding: an admin GET that does not prove it comes from the session's tab (full page
 *   loads never can) is sent to /admin/unlock, which renders no private data; that page
 *   proves the tab and continues with a client navigation that carries TAB_HEADER.
 * - Draft preview: copies the ?_pv= ticket of the preview iframe into PV_HEADER.
 * This is a convenience layer only: real authorization happens again in the
 * admin pages/actions (src/lib/admin/auth.ts) and in the database (RLS).
 */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Sign-in links that land on the site root with ?code= are finished by the callback route.
  if (pathname === "/" && searchParams.has("code")) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/callback";
    return NextResponse.redirect(url);
  }

  const isAdminArea = pathname.startsWith("/admin") || pathname.startsWith("/auth");
  if (!isAdminArea) {
    // Public page with the Draft Mode cookie: the ticket (if any) becomes a header the
    // draft source can verify. It is checked there (signature, user, current tab), never trusted here.
    const headers = new Headers(request.headers);
    headers.delete(PV_HEADER);
    const pv = searchParams.get(PV_PARAM);
    if (pv) headers.set(PV_HEADER, pv);
    return NextResponse.next({ request: { headers } });
  }

  let response = NextResponse.next({ request });
  if (!supabaseConfigured) return response;

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });
  const { data } = await supabase.auth.getUser();

  const isLogin = pathname === "/admin/login";
  const toLogin = (error?: string) => {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = error ? `?error=${error}` : "";
    return NextResponse.redirect(url);
  };
  if (pathname.startsWith("/admin") && !isLogin) {
    if (!data.user) return toLogin();
    const now = Date.now();
    const left = await idleLeft(request.cookies.get(ACT_COOKIE)?.value, data.user.id, now);
    if (left <= 0 || absoluteExpired(data.user.last_sign_in_at, now)) {
      await supabase.auth.signOut({ scope: "local" }); // revokes THIS session (other devices unaffected); clears its cookies on `response`
      const out = request.method === "GET" ? toLogin("expired") : NextResponse.json({ error: "expired" }, { status: 401 });
      response.cookies.getAll().forEach((c) => out.cookies.set(c));
      SESSION_COOKIES.forEach((name) => out.cookies.set(name, "", { ...cookieOptions(0), maxAge: 0 }));
      out.headers.set("Cache-Control", "private, no-store");
      return out;
    }
    const fromTab = await tabMatches(request.cookies.get(TAB_COOKIE)?.value, data.user.id, request.headers.get(TAB_HEADER));
    const gate = pathname === "/admin/unlock" || pathname === "/admin/session";
    if (request.method === "GET" && !fromTab && !gate) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/unlock";
      url.search = "";
      url.searchParams.set("next", pathname + request.nextUrl.search);
      const out = NextResponse.redirect(url);
      response.cookies.getAll().forEach((c) => out.cookies.set(c));
      out.headers.set("Cache-Control", "private, no-store");
      return out;
    }
    if (fromTab && !request.headers.has(PASSIVE_HEADER)) {
      const token = await activityToken(data.user.id, now);
      if (token) {
        // Forward the renewed value to this request's pages/actions too (same pattern as the Supabase cookies).
        request.cookies.set(ACT_COOKIE, token);
        const prev = response;
        response = NextResponse.next({ request });
        prev.cookies.getAll().forEach((c) => response.cookies.set(c));
        prev.headers.forEach((v, k) => { if (k !== "set-cookie" && !k.startsWith("x-middleware-")) response.headers.set(k, v); });
        response.cookies.set(ACT_COOKIE, token, cookieOptions(IDLE_MS));
      }
    }
  }
  // Admin pages are private and personal: never cache them.
  if (pathname.startsWith("/admin")) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/auth/:path*",
    { source: "/", has: [{ type: "query", key: "code" }] },
    // Draft preview only (visitors never have this cookie, so normal pages skip the proxy entirely).
    { source: "/((?!_next/|admin|auth|media/|work-media/).*)", has: [{ type: "cookie", key: "__prerender_bypass" }] },
  ],
};
