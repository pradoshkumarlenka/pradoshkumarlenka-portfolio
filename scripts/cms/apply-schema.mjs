// npm run cms:schema — applies supabase/cms.sql in ONE transaction.
// npm run cms:media  — applies supabase/media.sql the same way.
// Before committing it compares every pre-existing object (tables, columns,
// constraints, indexes, policies, functions, triggers, grants, enums, buckets,
// storage files, auth accounts and all existing rows) with the latest backup.
// Any difference → ROLLBACK, nothing is changed. Requires a backup (npm run cms:backup).
import fs from "node:fs";
import path from "node:path";
import { ROOT, db, redact, hashOf } from "./lib.mjs";

const SQL_FILE = process.argv[2] === "media" ? "media.sql" : "cms.sql";
const NEW_TABLES = SQL_FILE === "media.sql" ? ["media"] : ["content_published", "content_drafts", "content_versions"];
// CMS objects (tables content_*, functions content_*) are created/updated by cms.sql itself.
// Objects created by cms.sql / media.sql themselves (content_*, media*, the site-media bucket and its policies).
const OWN = /^(public.)?(content_|media)|site-media/;
const isNew = (r) => [r.tablename, r.table_name, r.tbl, r.proname, r.policyname, r.id].some((v) => v != null && (OWN.test(String(v)) || NEW_TABLES.includes(String(v))));
// For CMS tables that already hold data, these columns must survive any re-run unchanged.
const CMS_KEEP = { content_published: "key, data, version", content_drafts: "key, data", content_versions: "id, key, version, operation, data, changed_at, changed_by" };

const dir = path.join(ROOT, "backups");
const latest = fs.existsSync(dir) && fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, "manifest.json"))).sort().pop();
if (!latest) { console.error("No backup found — run `npm run cms:backup` first."); process.exit(1); }
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, latest, f), "utf8"));
const before = { catalog: read("catalog.json"), data: read("data.json"), storage: read("storage.json"), auth: read("auth.json") };
const sql = fs.readFileSync(path.join(ROOT, "supabase", SQL_FILE), "utf8");
const json = (v) => JSON.parse(JSON.stringify(v));

const c = await db();
try {
  await c.query("begin");
  await c.query(sql);
  const q = c.rows;
  const now = {
    tables: await q("select t.tablename, t.rowsecurity, c.relforcerowsecurity forcerowsecurity, c.relacl::text acl from pg_tables t join pg_class c on c.relname=t.tablename and c.relnamespace='public'::regnamespace where t.schemaname='public' order by 1"),
    columns: await q("select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' order by table_name, ordinal_position"),
    constraints: await q("select conrelid::regclass::text tbl, conname, pg_get_constraintdef(oid) def from pg_constraint where connamespace='public'::regnamespace order by 1,2"),
    indexes: await q("select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by 1,2"),
    policies: await q("select schemaname, tablename, policyname, cmd, roles::text, qual, with_check from pg_policies where schemaname in ('public','storage') order by 1,2,3"),
    functions: await q("select proname, prosecdef, proconfig::text, pg_get_functiondef(oid) def from pg_proc where pronamespace='public'::regnamespace order by 1"),
    triggers: await q("select tgrelid::regclass::text tbl, tgname, pg_get_triggerdef(oid) def from pg_trigger where not tgisinternal and tgrelid::regclass::text like 'public.%' order by 1,2"),
    grants: await q("select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') group by 1,2 order by 1,2"),
    enums: await q("select t.typname, string_agg(e.enumlabel, ',' order by e.enumsortorder) labels from pg_type t join pg_enum e on e.enumtypid=t.oid where t.typnamespace='public'::regnamespace group by 1"),
    buckets: await q("select id, public, file_size_limit, allowed_mime_types from storage.buckets order by 1"),
  };
  const problems = [];
  for (const [part, rows] of Object.entries(now)) {
    const keep = (r) => !isNew(r);
    const a = hashOf(before.catalog[part].filter(keep)), b = hashOf(json(rows).filter(keep));
    if (a !== b) problems.push(`existing ${part} changed`);
  }
  for (const t of Object.keys(before.data)) {
    if (CMS_KEEP[t]) {
      const cols = CMS_KEEP[t].split(", ");
      const was = before.data[t].map((r) => Object.fromEntries(cols.map((c) => [c, r[c]])));
      if (hashOf(was) !== hashOf(json(await q(`select ${CMS_KEEP[t]} from public.${t} order by 1`)))) problems.push(`content rows of ${t} changed`);
    } else if (hashOf(before.data[t]) !== hashOf(json(await q(`select * from public.${t} order by 1`)))) problems.push(`rows of ${t} changed`);
  }
  if (hashOf(before.storage) !== hashOf(json(await q("select bucket_id, name, metadata->>'size' size, metadata->>'mimetype' type, created_at, updated_at from storage.objects order by 1,2"))))
    problems.push("storage files changed");
  if (hashOf(before.auth) !== hashOf(json(await q("select id, email, email_confirmed_at, created_at, last_sign_in_at, is_anonymous from auth.users order by created_at"))))
    problems.push("auth accounts changed since the backup (take a new backup)");
  const added = (await q("select tablename from pg_tables where schemaname='public' and tablename = any($1)", [NEW_TABLES])).length;
  if (added !== NEW_TABLES.length) problems.push(`expected ${NEW_TABLES.length} new table(s), found ${added}`);

  if (problems.length) {
    await c.query("rollback");
    console.error("ROLLED BACK — nothing changed:\n  " + problems.join("\n  "));
    process.exitCode = 1;
  } else {
    await c.query("commit");
    console.log(`Applied supabase/${SQL_FILE}. Existing objects, rows, storage and auth identical to backup ${latest}.`);
  }
} catch (e) {
  await c.query("rollback").catch(() => {});
  console.error("ROLLED BACK — nothing changed:", redact(e.message));
  process.exitCode = 1;
} finally {
  await c.end();
}
