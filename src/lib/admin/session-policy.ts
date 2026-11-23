import "server-only";

/**
 * ADMIN SESSION POLICY (server only: proxy, route handlers, server actions).
 *
 * On top of Supabase Auth (short-lived JWT + refresh token) the admin area adds:
 *  - an IDLE limit: no admin activity for IDLE_MS → signed out;
 *  - an ABSOLUTE limit: ABSOLUTE_MS after the email sign-in → signed out, however active;
 *  - TAB BINDING: a sign-in grants access to the one tab that claims it (see /admin/session).
 *
 * State lives in httpOnly cookies signed with HMAC-SHA256. The key is derived from
 * SUPABASE_SECRET_KEY (never sent anywhere); without it the admin area fails closed.
 * Tokens are bound to the Supabase user id, so they are useless with another account.
 */

export const IDLE_MS = 30 * 60 * 1000;
export const ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const GRANT_MS = 5 * 60 * 1000;

export const ACT_COOKIE = "pkl_admin_act";
export const GRANT_COOKIE = "pkl_admin_grant";
export const TAB_COOKIE = "pkl_admin_tab";
export const SESSION_COOKIES = [ACT_COOKIE, GRANT_COOKIE, TAB_COOKIE];
/** Requests with this header check the session without counting as activity. */
export const PASSIVE_HEADER = "x-admin-passive";

export const cookieOptions = (maxAgeMs: number) => ({
  httpOnly: true,
  sameSite: "lax" as const, // the email link is a cross-site navigation; Strict would drop the cookie on its redirect
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: Math.floor(maxAgeMs / 1000),
});

const enc = new TextEncoder();
let keyPromise: Promise<CryptoKey> | null = null;

function key(): Promise<CryptoKey> | null {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) return null;
  keyPromise ??= crypto.subtle
    .digest("SHA-256", enc.encode(`pkl-admin-session-v1:${secret}`))
    .then((raw) => crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]));
  return keyPromise;
}

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

export const policyAvailable = () => Boolean(process.env.SUPABASE_SECRET_KEY);

async function sign(payload: string): Promise<string | null> {
  const k = key();
  if (!k) return null;
  return `${payload}.${b64url(await crypto.subtle.sign("HMAC", await k, enc.encode(payload)))}`;
}

/** Returns the payload fields if the signature is valid (constant-time check by WebCrypto). */
async function verify(token: string | undefined, kind: string): Promise<string[] | null> {
  const k = key();
  if (!k || !token || token.length > 400) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  let sig: Uint8Array;
  try {
    sig = fromB64url(token.slice(dot + 1));
  } catch {
    return null;
  }
  const ok = await crypto.subtle.verify("HMAC", await k, sig as BufferSource, enc.encode(payload));
  const parts = payload.split(".");
  return ok && parts[0] === kind ? parts.slice(1) : null;
}

export async function sha256Hex(s: string) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s))), (b) => b.toString(16).padStart(2, "0")).join("");
}

export const randomId = () => b64url(crypto.getRandomValues(new Uint8Array(32)));

// ── activity (idle limit) ────────────────────────────────────────────────────
export const activityToken = (userId: string, at = Date.now()) => sign(`act.${userId}.${at}`);

/** Milliseconds left before the idle limit, or 0 if expired/invalid/for another user. */
export async function idleLeft(token: string | undefined, userId: string, now = Date.now()): Promise<number> {
  const p = await verify(token, "act");
  if (!p || p[0] !== userId) return 0;
  const left = Number(p[1]) + IDLE_MS - now;
  return Number.isFinite(left) && left > 0 && left <= IDLE_MS ? left : 0;
}

/** Absolute limit, from the time of the last real sign-in (email link or code). */
export function absoluteExpired(lastSignInAt: string | null | undefined, now = Date.now()) {
  const t = lastSignInAt ? Date.parse(lastSignInAt) : NaN;
  return !Number.isFinite(t) || now - t > ABSOLUTE_MS;
}

// ── tab binding ──────────────────────────────────────────────────────────────
/** One-time permission (5 min) for the tab that completes the sign-in to claim the session. */
export const grantToken = (userId: string) => sign(`grant.${userId}.${Date.now() + GRANT_MS}.${randomId()}`);

/** The grant's nonce if it is valid for this user and not expired, else null. */
export async function grantNonce(token: string | undefined, userId: string) {
  const p = await verify(token, "grant");
  return p && p[0] === userId && Number(p[1]) > Date.now() && p[2] ? p[2] : null;
}

/** The tab cookie remembers which grant created it, so a grant can never be claimed twice. */
export const tabToken = async (userId: string, tabId: string, nonce: string) => sign(`tab.${userId}.${await sha256Hex(tabId)}.${nonce}`);

export async function tabNonce(token: string | undefined, userId: string) {
  const p = await verify(token, "tab");
  return p && p[0] === userId ? p[2] ?? null : null;
}

export async function tabMatches(token: string | undefined, userId: string, tabId: unknown) {
  if (typeof tabId !== "string" || !/^[A-Za-z0-9_-]{20,64}$/.test(tabId)) return false;
  const p = await verify(token, "tab");
  return Boolean(p && p[0] === userId && p[1] === (await sha256Hex(tabId)));
}

// ── tab proof on each request ────────────────────────────────────────────────
/** Sent by the admin tab on every same-origin fetch (RSC navigation, prefetch, server action). */
export const TAB_HEADER = "x-admin-tab";
/** Draft-preview ticket for loads that cannot carry a header (the preview iframe's document). */
export const PV_HEADER = "x-admin-pv";
export const PV_PARAM = "_pv";
export const PV_MS = 30 * 60 * 1000;

async function tabHashOf(token: string | undefined, userId: string) {
  const p = await verify(token, "tab");
  return p && p[0] === userId ? p[1] : null;
}

/** Ticket bound to the user AND the current tab: worthless once access moves to another tab. */
export async function previewTicket(tabCookie: string | undefined, userId: string) {
  const hash = await tabHashOf(tabCookie, userId);
  return hash ? sign(`pv.${userId}.${hash}.${Date.now() + PV_MS}`) : null;
}

/** True when this request proves it comes from the tab that holds the admin session. */
export async function tabProven(h: { get(name: string): string | null }, tabCookie: string | undefined, userId: string) {
  const tab = h.get(TAB_HEADER);
  if (tab && (await tabMatches(tabCookie, userId, tab))) return true;
  const pv = h.get(PV_HEADER);
  if (!pv) return false;
  const p = await verify(pv, "pv");
  return Boolean(p && p[0] === userId && Number(p[2]) > Date.now() && p[1] === (await tabHashOf(tabCookie, userId)));
}
