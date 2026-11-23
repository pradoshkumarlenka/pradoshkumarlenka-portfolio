import { draftMode } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getAdminSession } from "@/lib/admin/auth";
import { safePreviewPath } from "@/lib/admin/preview";

/**
 * POST /admin/preview/enable — turns on Draft Mode for the administrator and
 * opens the preview screen. Anyone else gets 403 and no cookie.
 * POST only (it changes state); the form lives on the admin pages.
 */
export async function POST(request: NextRequest) {
  const session = await getAdminSession();
  if (session.status !== "admin") return new NextResponse("Not authorised.", { status: 403 });
  // Same-origin form posts only (defence in depth on top of SameSite cookies).
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return new NextResponse("Bad origin.", { status: 403 });
  const form = await request.formData().catch(() => null);
  const path = safePreviewPath(form?.get("path"));
  (await draftMode()).enable();
  const url = new URL("/admin/preview", request.nextUrl.origin);
  url.searchParams.set("path", path);
  return NextResponse.redirect(url, 303);
}
