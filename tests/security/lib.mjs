// Shared helpers for the security tests (Node only — never imported by the website).
//
// SAFETY RULES (enforced in code below):
//   * Test items are ONLY those whose slug starts with "zztest-".
//   * Cleanup deletes ONLY those items and ONLY files under items/<their id>/.
//   * Test auth accounts are ONLY "zztest-…@test.invalid" addresses.
//   * Real items are never modified by any test.
// Secrets are read from .env.local and never printed.
import fs from "node:fs";
import nodeCrypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import pg from "pg";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(ROOT, "package.json"));
const { createClient } = require("@supabase/supabase-js");
const { createServerClient } = require("@supabase/ssr");

export const TEST_PREFIX = "zztest-";
export const SITE = (process.env.SITE ?? "http://localhost:3000").replace(/\/$/, "");
export const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";

export const env = Object.fromEntries(
  [...fs.readFileSync(path.join(ROOT, ".env.local"), "utf8").matchAll(/^([A-Z_]+)=[ \t]*(.*)$/gm)].map((m) => [m[1], m[2].trim()]),
);
for (const k of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY", "SUPABASE_DB_URL", "ADMIN_EMAIL"]) {
  if (!env[k]) throw new Error(`.env.local is missing ${k}`);
}
export const API = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
export const PUB = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET_HEADERS = { apikey: env.SUPABASE_SECRET_KEY, Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}` };
export const SECRET_VALUES = [env.SUPABASE_SECRET_KEY, env.SUPABASE_DB_URL, env.SUPABASE_DB_URL.match(/^postgres(?:ql)?:\/\/[^:]+:(.*)@[^@]+$/)?.[1]].filter((s) => s && s.length > 8);

/** Removes connection strings from error messages. */
export const redact = (s) => { let t = String(s); for (const v of SECRET_VALUES) t = t.split(v).join("[redacted]"); return t.replace(/postgres(ql)?:\/\/\S+/g, "[redacted]"); };

/** Postgres connection (parsed by hand: the password may contain URL-unsafe characters). */
export async function db() {
  const m = env.SUPABASE_DB_URL.match(/^postgres(?:ql)?:\/\/([^:]+):(.*)@([^:@/]+):(\d+)\/(.+)$/);
  if (!m) throw new Error("SUPABASE_DB_URL has an unexpected format");
  const c = new pg.Client({ user: m[1], password: m[2], host: m[3], port: +m[4], database: m[5], ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 20000 });
  await c.connect();
  c.rows = async (sql, params) => (await c.query(sql, params)).rows;
  return c;
}

/** Results collector. */
export function reporter(name) {
  const results = [];
  console.log(`\n── ${name}`);
  return {
    rec(label, pass, detail = "") {
      results.push(Boolean(pass));
      console.log(`${pass ? "PASS" : "FAIL"}  ${label}${detail ? `  —  ${redact(detail)}` : ""}`);
    },
    done() {
      const passed = results.filter(Boolean).length;
      console.log(`${passed}/${results.length} passed`);
      if (passed !== results.length) process.exitCode = 1;
      return passed === results.length;
    },
  };
}

/** Storage upload with the secret key (test fixtures only — always inside a zztest item's folder). */
export async function putFixture(client, itemId, name, body, type) {
  await assertTestItem(client, itemId);
  const r = await fetch(`${API}/storage/v1/object/work-files/items/${itemId}/${name}`, { method: "POST", headers: { ...SECRET_HEADERS, "Content-Type": type }, body });
  if (!r.ok) throw new Error(`fixture upload failed (${r.status})`);
  return `items/${itemId}/${name}`;
}

async function assertTestItem(client, itemId) {
  const r = await client.rows("select slug from public.items where id=$1", [itemId]);
  if (!r[0]?.slug.startsWith(TEST_PREFIX)) throw new Error(`refusing to touch non-test item ${itemId}`);
}

/** Creates a test item (slug is forced to start with zztest-). */
export async function createTestItem(client, suffix, fields = {}) {
  const slug = TEST_PREFIX + suffix;
  const cols = { slug, title: `ZZTEST ${suffix}`, state: "draft", sort_order: 100000, ...fields, slug };
  const keys = Object.keys(cols);
  const r = await client.rows(`insert into public.items (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")}) returning id`, keys.map((k) => cols[k]));
  return r[0].id;
}

/**
 * Deletes ONLY zztest- items, ONLY the files in their own folders, and ONLY zztest test accounts.
 * Safe to run any time (before and after each test file).
 */
export async function cleanup(client) {
  const items = await client.rows("select id, slug from public.items where slug like 'zztest-%'");
  for (const it of items) if (!it.slug.startsWith(TEST_PREFIX)) throw new Error("cleanup guard"); // belt and braces
  const ids = items.map((i) => i.id);
  if (ids.length) {
    const objs = (await client.rows("select name from storage.objects where bucket_id='work-files' and split_part(name,'/',1)='items' and split_part(name,'/',2) = any($1::text[])", [ids])).map((r) => r.name);
    if (objs.some((n) => !ids.includes(n.split("/")[1]))) throw new Error("cleanup guard (storage)");
    if (objs.length) {
      const r = await fetch(`${API}/storage/v1/object/work-files`, { method: "DELETE", headers: { ...SECRET_HEADERS, "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: objs }) });
      if (!r.ok) throw new Error(`cleanup: storage delete failed (${r.status})`);
    }
    await client.query("delete from public.items where id = any($1::uuid[]) and slug like 'zztest-%'", [ids]);
  }
  const users = await client.rows("select id from auth.users where email like 'zztest-%@test.invalid'");
  for (const u of users) await adminAuth().deleteUser(u.id);
  return { items: ids.length, users: users.length };
}

const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const adminAuth = () => createClient(API, env.SUPABASE_SECRET_KEY, opts).auth.admin;
export const visitorClient = () => createClient(API, PUB, opts);

/** Confirmed non-admin test account (zztest-…@test.invalid), created via the admin API. */
export async function createTestUser(name) {
  const email = `${TEST_PREFIX}${name}@test.invalid`;
  const { data, error } = await adminAuth().createUser({ email, email_confirm: true });
  if (error) throw new Error(`createUser failed: ${error.code}`);
  return { id: data.user.id, email };
}

/**
 * TEST-ONLY real session for an existing account, WITHOUT sending email
 * (official admin.generateLink + verifyOtp). Returns cookies in the exact
 * format @supabase/ssr reads, plus signOut(). Never used by the website.
 */
export async function sessionFor(email) {
  const { data, error } = await adminAuth().generateLink({ type: "magiclink", email });
  if (error) throw new Error(`generateLink failed: ${error.code}`);
  const anon = createClient(API, PUB, opts);
  const v = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: "magiclink" });
  if (v.error || !v.data.session) throw new Error(`verifyOtp failed: ${v.error?.code}`);
  const jar = new Map();
  const ssr = createServerClient(API, PUB, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  await ssr.auth.setSession(v.data.session);
  const host = new URL(SITE).hostname;
  // The site's admin session cookies (src/lib/admin/session-policy.ts): idle timer + one-time tab grant,
  // exactly as /auth/callback issues them after a real email sign-in.
  jar.set("pkl_admin_act", signSession(`act.${v.data.user.id}.${Date.now()}`));
  jar.set("pkl_admin_grant", signSession(`grant.${v.data.user.id}.${Date.now() + 5 * 60 * 1000}.${nodeCrypto.randomBytes(32).toString("base64url")}`));
  return {
    userId: v.data.user.id,
    accessToken: v.data.session.access_token,
    cookies: [...jar].map(([name, value]) => ({ name, value, domain: host, path: "/", sameSite: "Lax" })),
    cookieHeader: [...jar].map(([n, v2]) => `${n}=${v2}`).join("; "),
    signOut: async () => { const s = createClient(API, PUB, opts); await s.auth.setSession(v.data.session); await s.auth.signOut({ scope: "local" }); },
  };
}

/**
 * For fetch-based tests: does what the sign-in tab does (claims the one-time grant) and
 * returns headers proving this "tab" (cookie incl. the tab cookie + x-admin-tab).
 * Browser tests must NOT use it on the same session (the grant is then used up).
 */
export async function claimTab(session) {
  const r = await fetch(SITE + "/admin/session", { method: "POST", headers: { cookie: session.cookieHeader, "Content-Type": "application/json", Origin: SITE }, body: JSON.stringify({ op: "claim" }) });
  const body = await r.json();
  const tab = (r.headers.get("set-cookie") ?? "").match(/pkl_admin_tab=([^;]+)/)?.[1];
  if (!body.ok || !tab) throw new Error("tab claim failed");
  const cookie = session.cookieHeader.split("; ").filter((x) => !/^pkl_admin_(tab|grant)=/.test(x)).concat(`pkl_admin_tab=${tab}`).join("; ");
  return { tabId: body.tabId, cookie, headers: { cookie, "x-admin-tab": body.tabId } };
}

/** Same HMAC as src/lib/admin/session-policy.ts (key derived from the server secret). */
export function signSession(payload, secret = env.SUPABASE_SECRET_KEY) {
  const key = nodeCrypto.createHash("sha256").update(`pkl-admin-session-v1:${secret}`).digest();
  return `${payload}.${nodeCrypto.createHmac("sha256", key).update(payload).digest("base64url")}`;
}

export async function browser() {
  const puppeteer = (await import("puppeteer-core")).default;
  const b = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 120000 });
  // Admin pages render only after the tab guard has confirmed the session (SessionGuard):
  // make goto()/reload() on /admin pages wait for that, so tests see the real page.
  const probe = await b.newPage();
  const proto = Object.getPrototypeOf(probe);
  for (const m of ["goto", "reload"]) {
    if (proto[m].__adminAware) continue;
    const orig = proto[m];
    proto[m] = async function (...args) {
      const res = await orig.apply(this, args);
      if (new URL(this.url()).pathname.startsWith("/admin")) await this.waitForFunction(() => !document.querySelector("[data-session-checking]"), { timeout: 20000 }).catch(() => {});
      return res;
    };
    proto[m].__adminAware = true;
  }
  await probe.close();
  return b;
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
/** Polls fn() until truthy (max ~30 s). */
export async function until(fn, tries = 60) { for (let i = 0; i < tries; i++) { const v = await fn(); if (v) return v; await wait(500); } return null; }

/** Fails fast with a clear message if the site is not running. */
export async function requireSite() {
  try { const r = await fetch(SITE + "/admin/login"); if (r.status < 500) return; } catch {}
  console.log(`The site is not reachable at ${SITE}. Start it first (npm run dev) or set SITE=…`);
  process.exit(1);
}
