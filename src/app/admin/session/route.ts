import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getAdminSessionWithoutTab } from "@/lib/admin/auth";
import { ACT_COOKIE, GRANT_COOKIE, TAB_COOKIE, ABSOLUTE_MS, cookieOptions, grantNonce, idleLeft, randomId, tabMatches, tabNonce, tabToken } from "@/lib/admin/session-policy";

/**
 * POST /admin/session — tab binding for the admin area (JSON, same-origin only).
 *   { op: "claim" }         the tab that just signed in exchanges the one-time grant
 *                           cookie for a random tab id (kept in that tab's sessionStorage;
 *                           only its hash is stored, in a signed httpOnly cookie).
 *   { op: "check", tabId }  is this tab the one holding the session? + idle time left.
 * A new tab, window or another browser profile has no tab id → it is locked and must
 * sign in again, which moves access to it (the old tab then fails its next check).
 * The proxy runs first: an expired session never reaches this handler (401).
 */
const noStore = { "Cache-Control": "private, no-store" };
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: noStore });

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin || origin !== request.nextUrl.origin) return reply({ error: "forbidden" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ error: "bad-request" }, 400);
  let body: { op?: unknown; tabId?: unknown };
  try {
    body = await request.json();
  } catch {
    return reply({ error: "bad-request" }, 400);
  }
  const session = await getAdminSessionWithoutTab();
  if (session.status !== "admin") return reply({ error: "expired" }, 401);
  const jar = await cookies();
  const idle = await idleLeft(jar.get(ACT_COOKIE)?.value, session.userId);

  if (body.op === "claim") {
    const nonce = await grantNonce(jar.get(GRANT_COOKIE)?.value, session.userId);
    if (!nonce || nonce === (await tabNonce(jar.get(TAB_COOKIE)?.value, session.userId))) return reply({ ok: false, reason: "no-grant" });
    const tabId = randomId();
    const token = await tabToken(session.userId, tabId, nonce);
    if (!token) return reply({ error: "unconfigured" }, 500);
    const res = reply({ ok: true, tabId, idleLeft: idle });
    res.cookies.set(TAB_COOKIE, token, cookieOptions(ABSOLUTE_MS));
    res.cookies.set(GRANT_COOKIE, "", { ...cookieOptions(0), maxAge: 0 }); // one-time
    return res;
  }
  if (body.op === "check") {
    const ok = await tabMatches(jar.get(TAB_COOKIE)?.value, session.userId, body.tabId);
    return reply(ok ? { ok: true, idleLeft: idle } : { ok: false, reason: "other-tab" });
  }
  return reply({ error: "bad-request" }, 400);
}
