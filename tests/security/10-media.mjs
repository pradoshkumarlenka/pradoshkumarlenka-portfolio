// 10 — Media library: private bucket, records, delivery route, deletion guard, UI.
// Needs the site running. Uses zztest files only (titles "zztest…"), removed at the
// end; published content is never changed (published-path checks run in a
// rolled-back transaction). A temporary zztest draft of the contact block is used
// for the preview check (refuses to run if a real contact draft exists).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { API, PUB, ROOT, SITE, browser, cleanup, createTestUser, db, env, redact, reporter, requireSite, sessionFor, until, claimTab } from "./lib.mjs";

await requireSite();
const t = reporter("10 · Media library (private bucket, delivery, deletion guard, uploads)");
const require = createRequire(path.join(ROOT, "package.json"));
const sharp = require("sharp");
const c = await db();
const q = c.rows;
await cleanup(c);
const SECRET = env.SUPABASE_SECRET_KEY;
const svcStorage = (p, init = {}) => fetch(`${API}/storage/v1/object/${p}`, { ...init, headers: { apikey: SECRET, Authorization: `Bearer ${SECRET}`, ...(init.headers ?? {}) } });

async function cleanMedia() {
  const rows = await q("select id, path from public.media where title like 'zztest%'");
  if (!rows.length) return;
  await c.query("delete from public.content_drafts where key='contact' and data::text like '%zztest-media-draft%'");
  await c.query("delete from public.media where id = any($1::uuid[]) and title like 'zztest%'", [rows.map((r) => r.id)]);
  const r = await svcStorage("site-media", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prefixes: rows.map((x) => x.path) }) });
  if (!r.ok) throw new Error(`media cleanup failed (${r.status})`);
}
async function fixture(name, buf, mime) {
  const id = crypto.randomUUID();
  const p = `media/${id}/${name}`;
  const up = await svcStorage(`site-media/${p}`, { method: "POST", headers: { "Content-Type": mime }, body: buf });
  if (!up.ok) throw new Error(`fixture upload failed (${up.status})`);
  await c.query("insert into public.media (id, path, kind, mime, bytes, title) values ($1,$2,$3,$4,$5,$6)", [id, p, mime === "application/pdf" ? "pdf" : "image", mime, buf.length, `zztest ${name}`]);
  return { id, path: p, url: `/media/${id}/${name}` };
}
const token = (id, expSec) => {
  const key = crypto.createHmac("sha256", SECRET).update("site-media-preview-v1").digest();
  return `${expSec}.${crypto.createHmac("sha256", key).update(`${id}:${expSec}`).digest("base64url")}`;
};

const b = await browser();
let admin, outsider, madeDraft = false;
try {
  await cleanMedia();
  // ---- A. catalog
  const bucket = (await q("select id, public, file_size_limit, allowed_mime_types::text m from storage.buckets where id in ('site-media','work-files') order by id"));
  const sm = bucket.find((x) => x.id === "site-media"), wf = bucket.find((x) => x.id === "work-files");
  t.rec("site-media bucket is private, 15 MB, images (no SVG) + PDF only; work-files unchanged (private, 25 MB)",
    sm?.public === false && +sm.file_size_limit === 15728640 && sm.m === "{image/jpeg,image/png,image/webp,image/avif,application/pdf}" && wf?.public === false && +wf.file_size_limit === 26214400, JSON.stringify(bucket.map((x) => [x.id, x.public, x.file_size_limit])));
  const pol = await q("select policyname, cmd, roles::text r, coalesce(qual,'') || coalesce(with_check,'') e from pg_policies where schemaname='storage' and policyname like 'site-media%' order by 1");
  t.rec("4 site-media storage policies, signed-in admin only, files confined to media/<id>/, delete only when no record points to the file",
    pol.length === 4 && pol.every((p) => p.r === "{authenticated}" && p.e.includes("is_admin()")) && pol.find((p) => p.cmd === "DELETE")?.e.includes("NOT (EXISTS") && pol.filter((p) => p.cmd === "INSERT" || p.cmd === "UPDATE").every((p) => p.e.includes("media/")), pol.map((p) => p.cmd).join(","));
  const tbl = (await q("select relrowsecurity r from pg_class where oid='public.media'::regclass"))[0];
  const g = (await q("select grantee, string_agg(privilege_type, ',' order by privilege_type) p from information_schema.role_table_grants where table_schema='public' and table_name='media' and grantee in ('anon','authenticated','PUBLIC') group by 1")).map((r) => `${r.grantee}:${r.p}`).join(" ");
  t.rec("media table: RLS on, admin-only policy, no visitor privileges", tbl.r && g === "authenticated:DELETE,INSERT,SELECT,UPDATE", g);
  const fns = await q("select proname, prosecdef d, proconfig::text cfg, has_function_privilege('anon', oid, 'execute') a from pg_proc where pronamespace='public'::regnamespace and proname like 'media%' order by 1");
  t.rec("media functions: empty search_path; only media_public is SECURITY DEFINER and callable by visitors", fns.length === 3 && fns.every((f) => f.cfg === '{"search_path=\\"\\""}' && f.d === (f.proname === "media_public") && f.a === (f.proname === "media_public")), JSON.stringify(fns.map((f) => [f.proname, f.d, f.a])));

  // ---- B. fixtures
  const png = await sharp({ create: { width: 64, height: 40, channels: 3, background: "#a56bff" } }).png().toBuffer();
  const img = await fixture("zztest-a.png", png, "image/png");
  const pdf = await fixture("zztest-b.pdf", fs.readFileSync(path.join(ROOT, "public/resumes/Pradosh_Kumar_Lenka_Resume_Master.pdf")), "application/pdf");

  // ---- C. visitor + non-admin through the API
  const anon = (p, init = {}, tok = PUB) => fetch(API + p, { ...init, headers: { apikey: PUB, Authorization: `Bearer ${tok}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
  const u = await createTestUser("media");
  outsider = await sessionFor(u.email);
  const res = {};
  for (const [who, tok] of [["visitor", PUB], ["non-admin", outsider.accessToken]]) {
    res[who] = {
      table: await (await anon("/rest/v1/media?select=id", {}, tok)).text(),
      read: (await anon(`/storage/v1/object/site-media/${img.path}`, {}, tok)).status,
      pub: (await anon(`/storage/v1/object/public/site-media/${img.path}`, {}, tok)).status,
      sign: (await anon(`/storage/v1/object/sign/site-media/${img.path}`, { method: "POST", body: JSON.stringify({ expiresIn: 60 }) }, tok)).status,
      list: await (await anon("/storage/v1/object/list/site-media", { method: "POST", body: JSON.stringify({ prefix: "media/" }) }, tok)).text(),
      upload: (await fetch(`${API}/storage/v1/object/site-media/media/${crypto.randomUUID()}/x.png`, { method: "POST", headers: { apikey: PUB, Authorization: `Bearer ${tok}`, "Content-Type": "image/png" }, body: png })).status,
      del: (await anon(`/storage/v1/object/site-media/${img.path}`, { method: "DELETE" }, tok)).status,
    };
  }
  const still = (await svcStorage(`site-media/${img.path}`)).status;
  const noRows = (s) => s === "[]" || /42501|permission/i.test(s);
  t.rec("Visitors and non-admins cannot read records, download, sign, list, upload or delete library files",
    Object.values(res).every((r) => noRows(r.table) && r.read >= 400 && r.pub >= 400 && r.sign >= 400 && (r.list === "[]" || r.list.includes("error") || r.list.includes("rror")) && r.upload >= 400) && still === 200,
    JSON.stringify(res).slice(0, 300));

  // ---- D. delivery route
  const get = (p, headers = {}) => fetch(SITE + p, { headers, redirect: "manual" });
  const v1 = await get(img.url);
  const now = Math.floor(Date.now() / 1000);
  const good = await get(`${img.url}?pt=${token(img.id, now + 600)}`);
  const forged = await get(`${img.url}?pt=${token(img.id, now + 600).slice(0, -2)}xx`);
  const expired = await get(`${img.url}?pt=${token(img.id, now - 10)}`);
  const otherId = await get(`${img.url}?pt=${token(pdf.id, now + 600)}`);
  t.rec("Unused files are not served to visitors (404, not cached); a valid preview token works; forged, expired or other-file tokens do not",
    v1.status === 404 && /no-store/.test(v1.headers.get("cache-control") ?? "") && good.status === 200 && good.headers.get("content-type") === "image/png" && /private, no-store/.test(good.headers.get("cache-control") ?? "") && forged.status === 404 && expired.status === 404 && otherId.status === 404,
    `visitor ${v1.status}, token ${good.status}, forged ${forged.status}, expired ${expired.status}, other ${otherId.status}`);
  admin = await sessionFor(env.ADMIN_EMAIL);
  const adminNoTab = await get(pdf.url, { Cookie: admin.cookieHeader });
  const tabbed = await claimTab(admin);
  const asAdmin = await get(pdf.url, tabbed.headers);
  const asOther = await get(pdf.url, { Cookie: outsider.cookieHeader });
  const body = Buffer.from(await asAdmin.arrayBuffer());
  t.rec("The admin can open unpublished files (private, nosniff); a non-admin session cannot",
    asAdmin.status === 200 && asAdmin.headers.get("content-type") === "application/pdf" && body.subarray(0, 5).toString() === "%PDF-" && asAdmin.headers.get("x-content-type-options") === "nosniff" && /private/.test(asAdmin.headers.get("cache-control") ?? "") && asOther.status === 404,
    `admin ${asAdmin.status}, non-admin ${asOther.status}`);
  t.rec("…but only from the admin's tab: the same cookies without the tab proof (another tab) get 404", adminNoTab.status === 404, `no tab ${adminNoTab.status}`);
  const imgHeaders = good.headers.get("content-security-policy") ?? "";
  t.rec("Images are served with a sandboxing content security policy", /sandbox/.test(imgHeaders) && /default-src 'none'/.test(imgHeaders), imgHeaders.slice(0, 80));
  const bad = [await get("/media/not-a-uuid/x.png"), await get(`/media/${crypto.randomUUID()}/x.png`, tabbed.headers)];
  t.rec("Malformed or unknown ids → 404", bad.every((r) => r.status === 404));

  // ---- E. published-path rule + deletion guard (rolled back)
  await c.query("begin");
  try {
    await c.query("update public.content_published set data = jsonb_set(data, '{headshot}', to_jsonb($1::text)) where key='contact'", [img.url]);
    await c.query("set local role anon");
    const pendingRow = await q("select path from public.media_public($1)", [img.id]);
    await c.query("reset role");
    await c.query("update public.media set privacy_review = 'approved' where id = $1", [img.id]);
    await c.query("update public.media set privacy_review = 'approved' where id = $1", [pdf.id]);
    await c.query("set local role anon");
    const pubRow = await q("select path from public.media_public($1)", [img.id]);
    const notUsed = await q("select path from public.media_public($1)", [pdf.id]);
    await c.query("reset role");
    t.rec("media_public serves a file only when it is privacy-approved AND used by published content (visitor role)", pendingRow.length === 0 && pubRow.length === 1 && pubRow[0].path === img.path && notUsed.length === 0, `pending: ${pendingRow.length}, approved+used: ${pubRow.length}, approved+unused: ${notUsed.length}`);
    await c.query("savepoint r");
    await c.query("insert into public.media (id, path, kind, mime, bytes, title, privacy_review, reviewed_by) values ($1, $2, 'image', 'image/png', 10, 'zztest forged', 'approved', gen_random_uuid())", ["00000000-0000-4000-8000-000000000000", "media/00000000-0000-4000-8000-000000000000/x.png"]);
    const forged = (await q("select privacy_review, reviewed_by from public.media where id = '00000000-0000-4000-8000-000000000000'"))[0];
    await c.query("update public.media set path = 'media/' || id || '/y.png' where id = $1", [img.id]);
    const replaced = (await q("select privacy_review from public.media where id = $1", [img.id]))[0];
    await c.query("rollback to savepoint r");
    t.rec("New files can never arrive pre-approved (review stamps set by the database); a replaced file goes back to review", forged?.privacy_review === "pending" && forged.reviewed_by === null && replaced?.privacy_review === "pending");
    await c.query("savepoint s");
    let blocked = false;
    try { await c.query("delete from public.media where id=$1", [img.id]); } catch (e) { blocked = e.code === "23503"; }
    await c.query("rollback to savepoint s");
    t.rec("A file used by published content cannot be deleted (database trigger)", blocked);
  } finally {
    await c.query("rollback");
  }
  // storage object cannot be removed while its record exists — even by the admin
  const adminDel = await fetch(`${API}/storage/v1/object/site-media/${img.path}`, { method: "DELETE", headers: { apikey: PUB, Authorization: `Bearer ${admin.accessToken}` } });
  const after = (await svcStorage(`site-media/${img.path}`)).status;
  t.rec("A library file's storage object cannot be deleted while its record exists (even by the admin)", after === 200, `delete ${adminDel.status}, object ${after}`);

  // ---- F. browser: upload, reject fakes, edit alt, delete
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.setCookie(...admin.cookies);
  await p.goto(SITE + "/admin/media", { waitUntil: "load" });
  await p.waitForFunction(() => { const el = document.querySelector("input[type=file][multiple]"); return el && Object.keys(el).some((k) => k.startsWith("__react")); }, { timeout: 60000 });
  const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "zztest-media-"));
  const exif = await sharp({ create: { width: 120, height: 80, channels: 3, background: "#5fcf9f" } }).jpeg().withMetadata({ exif: { IFD0: { Copyright: "zztest-secret-gps-marker" } } }).toBuffer();
  fs.writeFileSync(path.join(DIR, "zztest-photo.jpg"), exif);
  fs.writeFileSync(path.join(DIR, "zztest-fake.png"), "MZ this is not an image");
  fs.writeFileSync(path.join(DIR, "zztest-vector.svg"), "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>");
  const input = await p.$("input[type=file][multiple]");
  await input.uploadFile(path.join(DIR, "zztest-photo.jpg"), path.join(DIR, "zztest-fake.png"), path.join(DIR, "zztest-vector.svg"));
  const done = await until(async () => { const s = await p.evaluate(() => document.querySelector("[role=alert],[role=status]")?.textContent ?? ""); return /zztest-vector\.svg/.test(s) && !/Uploading/.test(s) ? s : null; }, 120);
  const row = (await q("select id, path, width, height, bytes from public.media where title = 'zztest-photo'"))[0];
  const fakes = (await q("select count(*)::int n from public.media where title in ('zztest-fake','zztest-vector')"))[0].n;
  let stripped = false;
  if (row) { const f = await svcStorage(`site-media/${row.path}`); stripped = f.ok && !Buffer.from(await f.arrayBuffer()).includes(Buffer.from("zztest-secret-gps-marker")); }
  t.rec("UI upload: real JPEG accepted (dimensions read, photo metadata stripped); fake PNG and SVG rejected and not stored",
    Boolean(row) && row.width === 120 && row.height === 80 && stripped && fakes === 0 && /not a real \.png/.test(done ?? "") && /Allowed files/.test(done ?? ""), (done ?? "no message").slice(0, 200));
  if (row) await c.query("update public.media set title = 'zztest-photo' where id=$1", [row.id]);

  await p.reload({ waitUntil: "load" });
  await p.waitForFunction((id) => { const el = document.getElementById(`a-${id}`); return el && Object.keys(el).some((k) => k.startsWith("__react")); }, { timeout: 60000 }, row?.id);
  await p.type(`#a-${row.id}`, "zztest green rectangle");
  await p.evaluate((id) => { const card = document.getElementById(`a-${id}`).closest("li"); [...card.querySelectorAll("button")].find((x) => x.textContent.trim() === "Save").click(); }, row.id);
  const altSaved = await until(async () => ((await q("select alt from public.media where id=$1", [row.id]))[0]?.alt === "zztest green rectangle"), 40);
  t.rec("Alt text can be edited and saved", Boolean(altSaved));

  // Preview: a draft using the library image renders it through next/image (token), visitors unaffected.
  if (!(await q("select 1 from public.content_drafts where key='contact'")).length) {
    const contact = (await q("select data from public.content_published where key='contact'"))[0].data;
    const url = `/media/${row.id}/${row.path.split("/").pop()}`;
    await c.query("insert into public.content_drafts (key, data) values ('contact', $1::jsonb)", [JSON.stringify({ ...contact, headshot: url, headshotAlt: "zztest-media-draft" })]);
    madeDraft = true;
    await p.goto(SITE + "/admin/preview?path=/", { waitUntil: "load" });
    await p.waitForFunction(() => [...document.querySelectorAll("button")].some((x) => x.textContent.trim() === "Start preview" && Object.keys(x).some((k) => k.startsWith("__react"))), { timeout: 60000 });
    await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Start preview").click());
    // Drafts are visible only inside this tab: use the preview iframe.
    const pv = await until(async () => { const f = p.frames().find((x) => x !== p.mainFrame()); if (!f) return null; try { return (await f.evaluate(() => Boolean(document.getElementById("contact")))) ? f : null; } catch { return null; } }, 80);
    await pv.evaluate(() => document.getElementById("contact")?.scrollIntoView());
    const shown = await until(async () => pv.evaluate(() => { const im = [...document.images].find((i) => i.alt === "zztest-media-draft"); return im && im.complete && im.naturalWidth > 0 ? im.currentSrc : null; }), 60);
    const pubHtml = await (await fetch(SITE + "/")).text();
    t.rec("Draft preview shows a library image through the image optimizer (with a preview token); visitors do not get it", Boolean(shown) && /pt%3D|pt=/.test(shown ?? "") && !pubHtml.includes(row.id), (shown ?? "not shown").slice(0, 120));
    // Publishing a draft that uses an unreviewed file is refused (nothing changes)
    const pubBefore = await q("select version, content_hash from public.content_published where key='contact'");
    await p.goto(SITE + "/admin/content/contact", { waitUntil: "load" });
    await p.waitForFunction(() => [...document.querySelectorAll("button")].some((x) => x.textContent.trim() === "Publish" && !x.disabled && Object.keys(x).some((k) => k.startsWith("__react"))), { timeout: 60000 });
    await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Publish").click());
    const refusal = await until(async () => { const s = await p.evaluate(() => [...document.querySelectorAll("[role=alert]")].map((e) => e.textContent).join(" ")); return /privacy review/.test(s) ? s : null; }, 40);
    const pubAfter = await q("select version, content_hash from public.content_published where key='contact'");
    t.rec("Publishing content that uses a file still pending privacy review is refused; published content unchanged", Boolean(refusal) && JSON.stringify(pubAfter) === JSON.stringify(pubBefore), (refusal ?? "no refusal").slice(0, 140));
    // Approve through the UI (checklist required), recorded with the admin's id
    await p.goto(SITE + "/admin/media", { waitUntil: "load" });
    await p.waitForFunction((id) => { const el = document.getElementById(`a-${id}`); return el && Object.keys(el).some((k) => k.startsWith("__react")); }, { timeout: 60000 }, row.id);
    const approveDisabled = await p.evaluate((id) => [...document.getElementById(`a-${id}`).closest("li").querySelectorAll("button")].find((x) => x.textContent.trim() === "Approve for publication")?.disabled, row.id);
    await p.evaluate((id) => { const li = document.getElementById(`a-${id}`).closest("li"); li.querySelector("input[type=checkbox]").click(); }, row.id);
    await p.evaluate((id) => [...document.getElementById(`a-${id}`).closest("li").querySelectorAll("button")].find((x) => x.textContent.trim() === "Approve for publication").click(), row.id);
    const approved = await until(async () => { const r = (await q("select privacy_review, reviewed_by::text by from public.media where id=$1", [row.id]))[0]; return r?.privacy_review === "approved" ? r : null; }, 40);
    const adminId = (await q("select id::text from auth.users where lower(email)=lower($1)", [env.ADMIN_EMAIL]))[0]?.id;
    t.rec("Privacy approval needs the checklist ticked and is recorded with the admin's id", approveDisabled === true && approved?.by === adminId);
    // In use by a draft → the UI cannot delete it
    await p.goto(SITE + "/admin/media", { waitUntil: "load" });
    const delDisabled = await p.evaluate((id) => [...document.getElementById(`a-${id}`).closest("li").querySelectorAll("button")].find((x) => x.textContent.trim() === "Delete")?.disabled, row.id);
    t.rec("A file used by a draft shows where it is used and cannot be deleted", delDisabled === true);
    // (the preview iframe closes with its page)
    await p.goto(SITE + "/admin/preview", { waitUntil: "load" });
    if (await p.$("form[action='/admin/preview/exit'] button")) await Promise.all([p.waitForNavigation({ waitUntil: "load" }), p.click("form[action='/admin/preview/exit'] button")]);
    await c.query("delete from public.content_drafts where key='contact' and data->>'headshotAlt' = 'zztest-media-draft'");
    madeDraft = false;
  } else t.rec("Preview check skipped: a real contact draft exists", false);

  await p.goto(SITE + "/admin/media", { waitUntil: "load" });
  await p.waitForFunction((id) => { const el = document.getElementById(`a-${id}`); return el && Object.keys(el).some((k) => k.startsWith("__react")); }, { timeout: 60000 }, row.id);
  await p.evaluate((id) => [...document.getElementById(`a-${id}`).closest("li").querySelectorAll("button")].find((x) => x.textContent.trim() === "Delete").click(), row.id);
  const gone = await until(async () => (await q("select 1 from public.media where id=$1", [row.id])).length === 0, 40);
  // The record is removed first, then the stored file: wait for both.
  let objGone = 0;
  if (gone) await until(async () => { objGone = (await svcStorage(`site-media/${row.path}`)).status; return objGone >= 400; }, 40);
  t.rec("An unused file can be deleted from the UI (record and stored file removed)", Boolean(gone) && objGone >= 400, `object ${objGone}`);
  t.rec("No page errors in the media library", errs.length === 0, errs.slice(0, 2).join(" | "));
} catch (e) {
  t.rec("Test run completed", false, redact(e.message));
} finally {
  if (madeDraft) await c.query("delete from public.content_drafts where key='contact' and data->>'headshotAlt' = 'zztest-media-draft'").catch(() => {});
  await cleanMedia().catch((e) => console.log("cleanup:", redact(e.message)));
  await admin?.signOut().catch(() => {});
  await outsider?.signOut().catch(() => {});
  await b.close();
  await cleanup(c);
  await c.end();
  t.done();
}
