// 06 — Site content CMS (content_published / content_drafts / content_versions).
// Role tests run in ONE transaction that is rolled back; API tests use a
// visitor and a throw-away zztest- account. Published content is never changed:
// every block is hash-checked against the JSON files before and after.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { API, PUB, ROOT, cleanup, createTestUser, db, env, redact, reporter, sessionFor } from "./lib.mjs";

const t = reporter("06 · Site content CMS: tables, triggers, history and access");
const KEYS = ["site", "sections", "hero", "proof", "experience", "research", "leadership", "honours", "beyond", "resume", "contact", "footer", "ui", "design", "animation", "projects"];
const TABLES = ["content_published", "content_drafts", "content_versions"];
const canonical = (v) => Array.isArray(v) ? `[${v.map(canonical).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}` : JSON.stringify(v);
const hash = (v) => crypto.createHash("sha256").update(canonical(v)).digest("hex");
const jsonBlocks = () => {
  const dir = path.join(ROOT, "content");
  const b = Object.fromEntries(KEYS.filter((k) => k !== "projects").map((k) => [k, JSON.parse(fs.readFileSync(path.join(dir, `${k}.json`), "utf8"))]));
  b.projects = fs.readdirSync(path.join(dir, "projects")).filter((f) => f.endsWith(".json")).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dir, "projects", f), "utf8")));
  return b;
};
const JSONB = jsonBlocks();

const c = await db();
const q = c.rows;
const snapshot = async () => ({
  published: Object.fromEntries((await q("select key, data, version from public.content_published")).map((r) => [r.key, hash(r.data) + ":" + r.version])),
  drafts: (await q("select count(*)::int n from public.content_drafts"))[0].n,
  versions: (await q("select count(*)::int n, coalesce(max(id),0)::text m from public.content_versions"))[0],
});
await cleanup(c);
let user;
try {
  const start = await snapshot();
  // A block either is published exactly as in the JSON files, or a content update is staged:
  // its pending draft is exactly the JSON (published by the owner in the admin).
  const staged = Object.fromEntries((await q("select key, data from public.content_drafts")).map((r) => [r.key, hash(r.data)]));
  const matches = (k) => start.published[k]?.startsWith(hash(JSONB[k]) + ":") || staged[k] === hash(JSONB[k]);
  const stagedKeys = KEYS.filter((k) => !start.published[k]?.startsWith(hash(JSONB[k]) + ":") && staged[k] === hash(JSONB[k]));
  t.rec(`All ${KEYS.length} blocks match the JSON files (published, or staged as a draft awaiting publish)`, Object.keys(start.published).length === KEYS.length && KEYS.every(matches), stagedKeys.length ? `staged for publishing: ${stagedKeys.join(", ")}` : "all published");

  // ---- A. catalog
  const rls = await q("select relname, relrowsecurity r from pg_class where relnamespace='public'::regnamespace and relname = any($1)", [TABLES]);
  t.rec("Row-level security is on for all 3 CMS tables", rls.length === 3 && rls.every((r) => r.r));
  const grants = Object.fromEntries((await q("select grantee||'.'||table_name k, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants where table_schema='public' and table_name = any($1) and grantee in ('anon','authenticated','PUBLIC') group by 1", [TABLES])).map((r) => [r.k, r.p]));
  const want = { "authenticated.content_published": "DELETE,INSERT,SELECT,UPDATE", "authenticated.content_drafts": "DELETE,INSERT,SELECT,UPDATE", "authenticated.content_versions": "SELECT" };
  t.rec("API privileges are minimal (no TRUNCATE/TRIGGER/REFERENCES; no history writes; visitors have no table-wide access)", canonical(grants) === canonical(want), JSON.stringify(grants));
  const anonCols = (await q("select string_agg(column_name, ',' order by column_name) c from information_schema.column_privileges where table_schema='public' and grantee='anon' and table_name = any($1)", [TABLES]))[0].c;
  t.rec("Visitors may read only the published content columns (not who published it)", anonCols === "content_hash,data,key,schema_version,updated_at,version", anonCols);
  const fns = await q("select proname, prosecdef d, proconfig::text cfg, has_function_privilege('anon', oid, 'execute') a, has_function_privilege('authenticated', oid, 'execute') u from pg_proc where pronamespace='public'::regnamespace and proname like 'content\\_%'");
  const RPC = ["content_publish", "content_rollback"];
  t.rec("CMS functions: empty search_path; only the history writer is SECURITY DEFINER; visitors execute none; signed-in users only publish/rollback (admin-checked inside)",
    fns.length === 5 && fns.every((f) => f.cfg === '{"search_path=\\"\\""}' && !f.a && f.u === RPC.includes(f.proname) && f.d === (f.proname === "content_record_version")), JSON.stringify(fns.map((f) => [f.proname, f.d, f.a, f.u])));
  const trg = (await q("select tgname from pg_trigger where tgname like 'content\\_%' and tgenabled = 'O' order by 1")).map((r) => r.tgname).join(",");
  t.rec("History and guard triggers are installed and enabled", trg === "content_drafts_before,content_published_before,content_published_history,content_versions_no_change,content_versions_no_truncate", trg);

  // ---- B. visitor and signed-in non-admin through the real API
  const call = (p, token, init = {}) => fetch(API + p, { ...init, headers: { apikey: PUB, Authorization: `Bearer ${token ?? PUB}`, "Content-Type": "application/json", Prefer: "return=minimal", ...(init.headers ?? {}) } });
  const pubRows = await (await call("/rest/v1/content_published?select=key,data")).json();
  const dbPub = Object.fromEntries((await q("select key, data from public.content_published")).map((r) => [r.key, hash(r.data)]));
  t.rec("Visitor reads every published block, exactly as stored", Array.isArray(pubRows) && pubRows.length === KEYS.length && pubRows.every((r) => hash(r.data) === dbPub[r.key]));
  const vd = await (await call("/rest/v1/content_drafts?select=key")).json();
  const vv = await (await call("/rest/v1/content_versions?select=id")).json();
  t.rec("Visitor cannot read drafts or history", (!Array.isArray(vd) || vd.length === 0) && (!Array.isArray(vv) || vv.length === 0), `${JSON.stringify(vd).slice(0, 60)} ${JSON.stringify(vv).slice(0, 60)}`);
  user = await createTestUser("cms-other");
  const s = await sessionFor(user.email);
  const results = [];
  for (const [who, token] of [["visitor", undefined], ["non-admin", s.accessToken]]) {
    results.push([who, "insert", (await call("/rest/v1/content_published", token, { method: "POST", body: JSON.stringify({ key: "footer", data: { hacked: true } }) })).status]);
    results.push([who, "upsert", (await call("/rest/v1/content_published", token, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ key: "hero", data: { hacked: true } }) })).status]);
    results.push([who, "update", (await call("/rest/v1/content_published?key=eq.site", token, { method: "PATCH", body: JSON.stringify({ data: { hacked: true } }) })).status]);
    results.push([who, "delete", (await call("/rest/v1/content_published?key=eq.ui", token, { method: "DELETE" })).status]);
    results.push([who, "draft", (await call("/rest/v1/content_drafts", token, { method: "POST", body: JSON.stringify({ key: "site", data: {} }) })).status]);
    results.push([who, "history", (await call("/rest/v1/content_versions", token, { method: "POST", body: JSON.stringify({ key: "site", operation: "UPDATE", data: {} }) })).status]);
    results.push([who, "rpc", (await call("/rest/v1/rpc/content_record_version", token, { method: "POST", body: "{}" })).status]);
    results.push([who, "publish", (await call("/rest/v1/rpc/content_publish", token, { method: "POST", body: JSON.stringify({ p_key: "footer", p_expected_version: 1 }) })).status]);
    results.push([who, "rollback", (await call("/rest/v1/rpc/content_rollback", token, { method: "POST", body: JSON.stringify({ p_key: "footer", p_to_version: 1, p_expected_version: 1 }) })).status]);
  }
  const nd = await (await call("/rest/v1/content_drafts?select=key", s.accessToken)).json();
  const nv = await (await call("/rest/v1/content_versions?select=id", s.accessToken)).json();
  await s.signOut();
  const afterApi = await snapshot();
  t.rec("Visitor and signed-in non-admin cannot write content, drafts or history, or call trigger functions (verified in the database)",
    canonical(afterApi) === canonical(start), results.map((r) => r.join(" ")).join(", "));
  t.rec("Signed-in non-admin cannot read drafts or history", Array.isArray(nd) && nd.length === 0 && Array.isArray(nv) && nv.length === 0);

  // ---- C. roles inside a transaction (rolled back)
  await c.query("begin");
  const admin = (await q("select id, email from auth.users where lower(email)=lower($1) and email_confirmed_at is not null", [env.ADMIN_EMAIL]))[0];
  if (!admin) throw new Error("the administrator account is missing or unconfirmed");
  const ADMIN = { sub: admin.id, role: "authenticated", email: admin.email, is_anonymous: false };
  const OTHER = { sub: user.id, role: "authenticated", email: user.email, is_anonymous: false };
  const FORGED = { ...OTHER, email: admin.email };
  async function as(role, cl, sql, params) {
    await c.query("savepoint s");
    try {
      await c.query(`set local role ${role}`);
      await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(cl)]);
      const r = await c.query(sql, params);
      await c.query("reset role"); await c.query("release savepoint s");
      return { ok: true, rows: r.rows, count: r.rowCount };
    } catch (e) {
      await c.query("rollback to savepoint s"); await c.query("reset role");
      return { ok: false, code: e.code };
    }
  }
  const before = (await q("select version from public.content_published where key='footer'"))[0].version;
  const up = await as("authenticated", ADMIN, "update public.content_published set data = data || '{\"zztest\":1}'::jsonb, version = 999 where key='footer' returning version");
  const h = await q("select operation, version, changed_by::text by, data ? 'zztest' marked from public.content_versions where key='footer' order by id desc limit 1");
  t.rec("Administrator can update: version bumped by the database (client value ignored), history row with the admin's id",
    up.ok && up.count === 1 && up.rows[0].version === before + 1 && h[0]?.operation === "UPDATE" && h[0].version === before + 1 && h[0].by === admin.id && h[0].marked, JSON.stringify({ version: up.rows?.[0]?.version, history: h[0]?.operation, byAdmin: h[0]?.by === admin.id }));
  const dr = await as("authenticated", ADMIN, "insert into public.content_drafts (key, data, updated_by) values ('footer', '{}'::jsonb, gen_random_uuid()) returning updated_by::text by");
  t.rec("Administrator can save a draft; the author is set by the database (cannot be spoofed)", dr.ok && dr.rows[0].by === admin.id);
  const hr = await as("authenticated", ADMIN, "select count(*)::int n from public.content_versions");
  t.rec("Administrator can read history", hr.ok && hr.rows[0].n > 0);

  const forge = [];
  for (const [label, cl] of [["other", OTHER], ["forged-email", FORGED]]) {
    forge.push([label, "update", await as("authenticated", cl, "update public.content_published set data='{}'::jsonb where key='site'")]);
    forge.push([label, "insert", await as("authenticated", cl, "insert into public.content_drafts (key, data) values ('hero', '{}'::jsonb)")]);
    forge.push([label, "read-drafts", await as("authenticated", cl, "select count(*)::int n from public.content_drafts")]);
    forge.push([label, "read-history", await as("authenticated", cl, "select count(*)::int n from public.content_versions")]);
  }
  forge.push(["anon", "update", await as("anon", {}, "update public.content_published set data='{}'::jsonb where key='site'")]);
  const blocked = forge.every(([, op, r]) => op.startsWith("read") ? r.ok && r.rows[0].n === 0 : !r.ok || r.count === 0);
  t.rec("Non-admin, forged-email claim and anon: no writes, drafts and history invisible", blocked, forge.map(([l, op, r]) => `${l} ${op}:${r.ok ? (r.rows?.[0]?.n ?? r.count) : r.code}`).join(" "));

  const direct = await as("authenticated", ADMIN, "insert into public.content_versions (key, operation, data) values ('site','UPDATE','{}'::jsonb)");
  const editH = await as("authenticated", ADMIN, "update public.content_versions set data='{}'::jsonb");
  const delH = await as("authenticated", ADMIN, "delete from public.content_versions");
  t.rec("History cannot be forged, edited or deleted by the administrator", !direct.ok && (!editH.ok || editH.count === 0) && (!delH.ok || delH.count === 0), `${direct.code} ${editH.code ?? editH.count} ${delH.code ?? delH.count}`);
  await c.query("savepoint o");
  let ownerBlocked = false;
  try { await c.query("delete from public.content_versions"); } catch (e) { ownerBlocked = e.code === "42501"; }
  await c.query("rollback to savepoint o");
  await c.query("savepoint o2");
  let truncBlocked = false;
  try { await c.query("truncate public.content_versions"); } catch (e) { truncBlocked = e.code === "42501"; }
  await c.query("rollback to savepoint o2");
  t.rec("History cannot be deleted or truncated with ordinary SQL, even by the owner role (only by deliberately disabling the triggers)", ownerBlocked && truncBlocked);

  // Publish workflow: draft → publish → history (source, note) → draft removed; stale versions refused; rollback.
  const cur = (await q("select version from public.content_published where key='contact'"))[0].version;
  await as("authenticated", ADMIN, `insert into public.content_drafts (key, data, base_version) select key, data || '{"location":"zztest"}'::jsonb, version from public.content_published where key='contact'`);
  const stale = await as("authenticated", ADMIN, "select public.content_publish('contact', $1, 'zztest') v", [cur + 5]);
  const pubd = await as("authenticated", ADMIN, "select public.content_publish('contact', $1, 'zztest note') v", [cur]);
  const ph = await q("select source, note, version, changed_by::text by from public.content_versions where key='contact' order by id desc limit 1");
  const left = (await q("select count(*)::int n from public.content_drafts where key='contact'"))[0].n;
  const pubRow = (await q("select data->>'location' loc, published_by::text by, content_hash = encode(sha256(jsonb_send(data)),'hex') h from public.content_published where key='contact'"))[0];
  t.rec("Publish: stale version refused; draft becomes the next version; history records source, note and admin; draft cleared; hash computed",
    !stale.ok && stale.code === "40001" && pubd.ok && pubd.rows[0].v === cur + 1 && ph[0].source === "publish" && ph[0].note === "zztest note" && ph[0].version === cur + 1 && ph[0].by === admin.id && left === 0 && pubRow.loc === "zztest" && pubRow.by === admin.id && pubRow.h,
    JSON.stringify({ stale: stale.code, v: pubd.rows?.[0]?.v, src: ph[0]?.source, left }));
  const rb = await as("authenticated", ADMIN, "select public.content_rollback('contact', $1, $2) v", [cur, cur + 1]);
  const rbRow = (await q("select data, version from public.content_published where key='contact'"))[0];
  const rbH = (await q("select source from public.content_versions where key='contact' order by id desc limit 1"))[0];
  t.rec("Rollback restores an earlier version as a NEW version (history kept, source 'rollback')", rb.ok && rbRow.version === cur + 2 && hash(rbRow.data) === hash(JSONB.contact) && rbH.source === "rollback", JSON.stringify({ ok: rb.ok, v: rbRow.version, src: rbH.source }));
  const rbo = await as("authenticated", OTHER, "select public.content_rollback('contact', $1, $2) v", [cur, cur + 2]);
  const pbo = await as("authenticated", FORGED, "select public.content_publish('contact', $1) v", [cur + 2]);
  t.rec("Publish and rollback refused for a non-admin and a forged-email claim", !rbo.ok && !pbo.ok, `${rbo.code} ${pbo.code}`);

  const badKey = await as("authenticated", ADMIN, "insert into public.content_published (key, data) values ('zztest-unknown', '{}'::jsonb)");
  const badShape = await as("authenticated", ADMIN, "update public.content_published set data = '\"text\"'::jsonb where key='ui'");
  const big = await as("authenticated", ADMIN, "update public.content_published set data = jsonb_build_object('x', repeat('a', 1100000)) where key='ui'");
  t.rec("Unknown keys, non-object data and blocks over 1 MB are rejected", !badKey.ok && !badShape.ok && !big.ok, `${badKey.code} ${badShape.code} ${big.code}`);
  await c.query("rollback");

  const end = await snapshot();
  t.rec("Nothing persisted: published content, drafts and history unchanged", canonical(end) === canonical(start));
} catch (e) {
  await c.query("rollback").catch(() => {});
  t.rec("Test run completed", false, redact(e.message));
} finally {
  await cleanup(c);
  await c.end();
  t.done();
}
