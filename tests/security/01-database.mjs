// 01 — Database structure and role-level security (no website needed).
// Part A is read-only. Part B runs inside ONE transaction that is ROLLED BACK.
import { cleanup, db, env, redact, reporter } from "./lib.mjs";

const t = reporter("01 · Database structure & row-level security");
const c = await db();
await cleanup(c);
const q = c.rows;
try {
  // ---- A. catalog (read-only)
  // Exact allowlists: any unexpected table, policy or privilege in the public schema fails these checks.
  // (CMS tables from supabase/cms.sql are covered in detail by 06-content-cms.mjs.)
  const EXPECTED_TABLES = ["admins", "attachments", "content_drafts", "content_published", "content_versions", "items", "media"];
  const tables = await q("select tablename t, rowsecurity rls from pg_tables where schemaname='public' order by 1");
  t.rec("Exactly the expected public tables (admins, attachments, items + 3 CMS + media), RLS on for all", JSON.stringify(tables.map((r) => r.t)) === JSON.stringify(EXPECTED_TABLES) && tables.every((r) => r.rls), JSON.stringify(tables));
  const pol = await q("select tablename, cmd, roles::text, qual, with_check from pg_policies where schemaname='public' order by 1,2");
  const EXPECTED_POLICIES = [
    "attachments:DELETE:{authenticated}", "attachments:INSERT:{authenticated}", "attachments:SELECT:{anon,authenticated}", "attachments:UPDATE:{authenticated}",
    "content_drafts:ALL:{authenticated}", "content_published:DELETE:{authenticated}", "content_published:INSERT:{authenticated}", "content_published:SELECT:{anon,authenticated}",
    "content_published:UPDATE:{authenticated}", "content_versions:SELECT:{authenticated}",
    "items:DELETE:{authenticated}", "items:INSERT:{authenticated}", "items:SELECT:{anon,authenticated}", "items:UPDATE:{authenticated}",
    "media:ALL:{authenticated}",
  ];
  const polList = pol.map((p) => `${p.tablename}:${p.cmd}:${p.roles}`);
  // Every write policy (and every non-public read) must be gated by is_admin().
  const gated = pol.filter((p) => !(p.cmd === "SELECT" && p.roles === "{anon,authenticated}")).every((p) => [p.qual, p.with_check].filter(Boolean).every((x) => x.includes("is_admin()")) && (p.qual ?? p.with_check));
  t.rec("Exactly 15 table policies (8 original + 6 CMS + 1 media); writes only for authenticated and gated by is_admin()", JSON.stringify(polList) === JSON.stringify(EXPECTED_POLICIES) && gated, polList.join(" "));
  t.rec("admins table has no policies (unreadable through the API)", (await q("select count(*)::int n from pg_policies where tablename='admins'"))[0].n === 0);
  const spol = await q("select cmd, roles::text from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'work-files%'");
  t.rec("4 storage policies, none for visitors", spol.length === 4 && spol.every((p) => p.roles === "{authenticated}"), spol.map((p) => p.cmd).join(","));
  const grants = await q("select grantee, table_name, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') group by 1,2 order by 1,2");
  t.rec("Grants exactly as expected: visitors SELECT only (no drafts/history); no TRUNCATE; nothing on admins", JSON.stringify(grants.map((g) => `${g.grantee}:${g.table_name}:${g.p}`)) === JSON.stringify([
    "anon:attachments:SELECT", "anon:items:SELECT", // content_published: column-level read for visitors (checked in 06)
    "authenticated:attachments:DELETE,INSERT,SELECT,UPDATE", "authenticated:content_drafts:DELETE,INSERT,SELECT,UPDATE",
    "authenticated:content_published:DELETE,INSERT,SELECT,UPDATE", "authenticated:content_versions:SELECT", "authenticated:items:DELETE,INSERT,SELECT,UPDATE",
    "authenticated:media:DELETE,INSERT,SELECT,UPDATE",
  ]), grants.map((g) => `${g.grantee}:${g.table_name}:${g.p}`).join(" "));
  const fnAll = (await q("select proname, prosecdef d from pg_proc where pronamespace='public'::regnamespace order by 1")).map((r) => r.proname + (r.d ? "*" : ""));
  t.rec("Exactly the expected public functions (* = SECURITY DEFINER)", JSON.stringify(fnAll) === JSON.stringify(["content_before_write", "content_publish", "content_record_version*", "content_rollback", "content_versions_immutable", "is_admin*", "items_set_timestamps", "media_guard_delete", "media_public*", "media_touch", "rls_auto_enable*"]), fnAll.join(" "));
  const b = await q("select public, file_size_limit, array_length(allowed_mime_types,1) n from storage.buckets where id='work-files'");
  t.rec("Bucket work-files is private, 25 MB, 10 allowed types", b[0]?.public === false && +b[0].file_size_limit === 26214400 && b[0].n === 10);
  const adm = await q("select email from public.admins");
  t.rec("Admin allowlist = ADMIN_EMAIL only", adm.length === 1 && adm[0].email === env.ADMIN_EMAIL.toLowerCase());
  const fn = await q("select prosecdef, proconfig::text cfg from pg_proc where proname='is_admin' and pronamespace='public'::regnamespace");
  t.rec("is_admin() is SECURITY DEFINER with an empty search_path", fn[0]?.prosecdef && fn[0].cfg === '{"search_path=\\"\\""}', fn[0]?.cfg);
  const signup = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } })).json();
  t.rec("Public sign-ups are disabled", signup.disable_signup === true);

  // ---- B. roles (rolled back)
  await c.query("begin");
  const admin = (await q("select id, email from auth.users where lower(email)=lower($1) and email_confirmed_at is not null", [env.ADMIN_EMAIL]))[0];
  if (!admin) throw new Error("the administrator account is missing or unconfirmed");
  const other = (await q("insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, is_anonymous) values ('00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', 'zztest-roles@test.invalid', now(), now(), now(), '{}', '{}', false) returning id"))[0].id;
  const claims = (sub, email) => ({ sub, role: "authenticated", email, is_anonymous: false });
  const ADMIN = claims(admin.id, admin.email), OTHER = claims(other, "zztest-roles@test.invalid"), FORGED = claims(other, admin.email);
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
  const isA = await as("authenticated", ADMIN, "select public.is_admin() v");
  const isO = await as("authenticated", OTHER, "select public.is_admin() v");
  const isF = await as("authenticated", FORGED, "select public.is_admin() v");
  t.rec("is_admin(): true for the real administrator; false for another account and a forged email claim", isA.rows[0].v === true && isO.rows[0].v === false && isF.rows[0].v === false);
  const ins = await as("authenticated", ADMIN, "insert into public.items (slug, title) values ('zztest-roles-a', 'ZZTEST roles a') returning id");
  const ins2 = await as("authenticated", ADMIN, "insert into public.items (slug, title) values ('zztest-roles-b', 'ZZTEST roles b') returning id");
  const [a, bId] = [ins.rows?.[0]?.id, ins2.rows?.[0]?.id];
  const pub = await as("authenticated", ADMIN, "update public.items set state='published' where id=$1 returning published_at", [a]);
  t.rec("Administrator can create and publish (publish date set by the database)", ins.ok && pub.count === 1 && pub.rows[0].published_at !== null);
  const cross = await as("authenticated", ADMIN, "insert into public.attachments (item_id, title, kind, storage_path, size_bytes) values ($1,'x','pdf',$2,1)", [a, `items/${bId}/x.pdf`]);
  const trav = await as("authenticated", ADMIN, "insert into public.attachments (item_id, title, kind, storage_path, size_bytes) values ($1,'x','pdf',$2,1)", [a, `items/${a}/../${bId}/x.pdf`]);
  const sTrav = await as("authenticated", ADMIN, "insert into storage.objects (bucket_id, name, owner) values ('work-files', $1, $2)", [`items/${a}/../../x.pdf`, admin.id]);
  t.rec("Files cannot point into another item's folder (incl. ../), even for the admin", !cross.ok && !trav.ok && !sTrav.ok, `${cross.code} ${trav.code} ${sTrav.code}`);
  const oIns = await as("authenticated", OTHER, "insert into public.items (slug, title) values ('zztest-roles-x','x')");
  const oUpd = await as("authenticated", OTHER, "update public.items set title='hack' where id=$1", [a]);
  const oDraft = await as("authenticated", OTHER, "select count(*)::int n from public.items where id=$1", [bId]);
  const oFile = await as("authenticated", OTHER, "insert into storage.objects (bucket_id, name, owner) values ('work-files', $1, $2)", [`items/${a}/x.pdf`, other]);
  t.rec("A signed-in non-admin cannot write, see drafts or upload", !oIns.ok && oUpd.count === 0 && oDraft.rows[0].n === 0 && !oFile.ok);
  const fIns = await as("authenticated", FORGED, "insert into public.items (slug, title) values ('zztest-roles-f','x')");
  t.rec("A token that only claims the admin email cannot write", !fIns.ok, fIns.code);
  const blocked = [];
  for (const [role, cl] of [["anon", { role: "anon" }], ["authenticated", OTHER], ["authenticated", ADMIN]]) {
    for (const sql of ["truncate public.items cascade", "drop table public.items cascade", "alter table public.items disable row level security", "delete from public.admins", "insert into public.admins values ('zztest@test.invalid')", "update storage.buckets set public=true where id='work-files'"]) {
      const r = await as(role, cl, sql);
      blocked.push(!r.ok || r.count === 0);
    }
  }
  t.rec("Destructive SQL blocked for visitors, other accounts and the admin's API session", blocked.every(Boolean), `${blocked.filter(Boolean).length}/${blocked.length}`);
} catch (e) {
  t.rec("Test run completed", false, redact(e.message));
} finally {
  await c.query("rollback").catch(() => {});
  await cleanup(c);
  await c.end();
  t.done();
}
