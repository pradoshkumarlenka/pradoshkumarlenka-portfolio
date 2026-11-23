import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SESSION_COOKIES, cookieOptions } from "@/lib/admin/session-policy";

/**
 * Sign out (POST only, same-site only). Ends the Supabase session, clears the
 * session cookies and sends the browser to the login page with a full redirect.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return new NextResponse("Forbidden", { status: 403 });
  const supabase = await createClient();
  await supabase.auth.signOut();
  const res = NextResponse.redirect(new URL("/admin/login", request.nextUrl.origin), { status: 303 });
  SESSION_COOKIES.forEach((name) => res.cookies.set(name, "", { ...cookieOptions(0), maxAge: 0 }));
  return res;
}
