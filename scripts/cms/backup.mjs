// npm run cms:backup — full read-only snapshot of the existing database state.
// Writes backups/<timestamp>/ (git-ignored: contains the admin email):
//   data.json     every row of public.admins, public.items, public.attachments (+ CMS tables if present)
//   catalog.json  tables, columns, constraints, indexes, policies, functions, triggers, grants, buckets
//   storage.json  every file in the work-files bucket (name, size, type, dates)
//   auth.json     auth accounts (id, email, confirmed, created) — no passwords/tokens exist in this table's export
// Runs inside a READ ONLY transaction: it cannot change anything.
import fs from "node:fs";
import path from "node:path";
import { ROOT, db, redact, hashOf } from "./lib.mjs";

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const OUT = path.join(ROOT, "backups", stamp);
const c = await db();
try {
  await c.query("begin transaction read only");
  const q = c.rows;
  const tables = (await q("select tablename from pg_tables where schemaname='public' order by 1")).map((r) => r.tablename);
  const data = {};
  for (const t of tables) data[t] = await q(`select * from public.${JSON.stringify(t).slice(1, -1)} order by 1`);
  const catalog = {
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
  const storage = await q("select bucket_id, name, metadata->>'size' size, metadata->>'mimetype' type, created_at, updated_at from storage.objects order by 1,2");
  const auth = await q("select id, email, email_confirmed_at, created_at, last_sign_in_at, is_anonymous from auth.users order by created_at");
  await c.query("rollback");

  fs.mkdirSync(OUT, { recursive: true });
  const files = { "data.json": data, "catalog.json": catalog, "storage.json": storage, "auth.json": auth };
  const manifest = { createdAt: new Date().toISOString(), counts: {}, sha256: {} };
  for (const [name, value] of Object.entries(files)) {
    const text = JSON.stringify(value, null, 2); // dates become ISO strings here
    fs.writeFileSync(path.join(OUT, name), text);
    manifest.sha256[name] = hashOf(JSON.parse(text));
  }
  for (const t of tables) manifest.counts[t] = data[t].length;
  manifest.counts.storageFiles = storage.length;
  manifest.counts.authUsers = auth.length;
  manifest.counts.policies = catalog.policies.length;
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
  // Re-read and check what was written.
  const ok = Object.keys(files).every((n) => hashOf(JSON.parse(fs.readFileSync(path.join(OUT, n), "utf8"))) === manifest.sha256[n]);
  console.log(`Backup ${ok ? "written and verified" : "WRITTEN BUT VERIFICATION FAILED"}: backups/${stamp}`);
  console.log("counts:", JSON.stringify(manifest.counts));
  if (!ok) process.exitCode = 1;
} catch (e) {
  console.error("Backup failed:", redact(e.message));
  process.exitCode = 1;
} finally {
  await c.end();
}
