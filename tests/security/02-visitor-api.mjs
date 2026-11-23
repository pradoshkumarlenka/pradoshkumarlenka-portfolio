// 02 — What an anonymous visitor can do directly against the Supabase API
// (publishable key only). Uses isolated zztest- items; real items untouched.
import { API, PUB, cleanup, createTestItem, db, putFixture, redact, reporter } from "./lib.mjs";

const t = reporter("02 · Visitor access to the database API and private storage");
const c = await db();
await cleanup(c);
const anon = (path, init = {}) => fetch(API + path, { ...init, headers: { apikey: PUB, "Content-Type": "application/json", ...(init.headers ?? {}) } });
const PDF = Buffer.from("%PDF-1.4\n%%EOF\n");
try {
  const pub = await createTestItem(c, "visitor-pub", { state: "published" });
  const draft = await createTestItem(c, "visitor-draft", { state: "draft" });
  const arch = await createTestItem(c, "visitor-arch", { state: "archived" });
  const pf = await putFixture(c, pub, "pub.pdf", PDF, "application/pdf");
  const df = await putFixture(c, draft, "draft.pdf", PDF, "application/pdf");
  await c.query("insert into public.attachments (item_id, title, kind, storage_path, size_bytes) values ($1,'pub','pdf',$2,15), ($3,'draft','pdf',$4,15)", [pub, pf, draft, df]);

  const seen = await (await anon("/rest/v1/items?select=slug&slug=like.zztest-visitor-*")).json();
  t.rec("Visitor sees only the published test item", seen.length === 1 && seen[0].slug === "zztest-visitor-pub", JSON.stringify(seen));
  const byId = await (await anon(`/rest/v1/items?select=id&id=in.(${draft},${arch})`)).json();
  t.rec("Drafts and archived items are invisible, even by id", byId.length === 0);
  const att = await (await anon("/rest/v1/attachments?select=storage_path")).json();
  t.rec("Visitor sees attachment records of published items only", att.some((a) => a.storage_path === pf) && !att.some((a) => a.storage_path === df));
  const adm = await anon("/rest/v1/admins?select=email");
  t.rec("Admin allowlist is unreadable", adm.status >= 400, `HTTP ${adm.status}`);
  const ins = await anon("/rest/v1/items", { method: "POST", body: JSON.stringify({ slug: "zztest-visitor-hack", title: "x" }) });
  const upd = await anon(`/rest/v1/items?id=eq.${pub}`, { method: "PATCH", body: JSON.stringify({ title: "HACKED" }) });
  const del = await anon(`/rest/v1/items?id=eq.${pub}`, { method: "DELETE" });
  const row = await c.rows("select title from public.items where id=$1", [pub]);
  const hack = await c.rows("select count(*)::int n from public.items where slug='zztest-visitor-hack'");
  t.rec("Visitor cannot insert, update or delete (verified in the database)", ins.status >= 400 && row[0]?.title === "ZZTEST visitor-pub" && hack[0].n === 0, `insert ${ins.status}, patch ${upd.status}, delete ${del.status}`);
  const g1 = await anon(`/storage/v1/object/work-files/${pf}`);
  const g2 = await anon(`/storage/v1/object/public/work-files/${df}`);
  const sign = await anon(`/storage/v1/object/sign/work-files/${pf}`, { method: "POST", body: JSON.stringify({ expiresIn: 60 }) });
  t.rec("Visitor cannot download or sign private files (even published ones)", g1.status >= 400 && g2.status >= 400 && sign.status >= 400, `${g1.status} ${g2.status} ${sign.status}`);
  const up = await fetch(`${API}/storage/v1/object/work-files/items/${pub}/evil.pdf`, { method: "POST", headers: { apikey: PUB, "Content-Type": "application/pdf" }, body: PDF });
  const mk = await anon("/storage/v1/bucket/work-files", { method: "PUT", body: JSON.stringify({ public: true }) });
  const bucket = await c.rows("select public from storage.buckets where id='work-files'");
  t.rec("Visitor cannot upload, or make the bucket public", up.status >= 400 && bucket[0].public === false, `upload ${up.status}, bucket ${mk.status}`);
} catch (e) {
  t.rec("Test run completed", false, redact(e.message));
} finally {
  await cleanup(c);
  await c.end();
  t.done();
}
