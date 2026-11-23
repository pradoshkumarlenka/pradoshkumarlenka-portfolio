import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

/** POST /admin/preview/exit — turns Draft Mode off (safe for anyone: it only removes a cookie). */
export async function POST(request: NextRequest) {
  (await draftMode()).disable();
  const form = await request.formData().catch(() => null);
  const back = form?.get("back") === "site" ? "/" : "/admin/content";
  return NextResponse.redirect(new URL(back, request.nextUrl.origin), 303);
}
