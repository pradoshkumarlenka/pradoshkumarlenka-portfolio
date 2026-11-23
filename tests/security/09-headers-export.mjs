// 09 — Security headers and the admin content export. Needs the site running.
import { SITE, cleanup, createTestUser, db, env, redact, reporter, requireSite, sessionFor, claimTab } from "./lib.mjs";

await requireSite();
const t = reporter("09 · Security headers and content export");
const c = await db();
await cleanup(c);
let admin, outsider;
try {
  const pages = ["/", "/projects/dfi-bond-portfolio", "/admin/login"];
  const results = [];
  for (const p of pages) {
    const r = await fetch(SITE + p, { redirect: "manual" });
    const h = (k) => r.headers.get(k) ?? "";
    results.push({ p, ok: h("content-security-policy").includes("frame-ancestors 'self'") && h("x-frame-options") === "SAMEORIGIN" && h("x-content-type-options") === "nosniff" && h("referrer-policy") === "strict-origin-when-cross-origin" && h("permissions-policy").includes("camera=()") && !h("x-powered-by") });
  }
  t.rec("Every page sends anti-framing, no-sniff, referrer and permissions headers (and no X-Powered-By)", results.every((r) => r.ok), results.map((r) => `${r.p}:${r.ok}`).join(" "));

  const anon = await fetch(SITE + "/admin/content/export", { redirect: "manual" });
  const u = await createTestUser("export");
  outsider = await sessionFor(u.email);
  const other = await fetch(SITE + "/admin/content/export", { redirect: "manual", headers: { Cookie: outsider.cookieHeader } });
  const otherBody = other.status === 200 ? await other.text() : "";
  t.rec("Content export is refused to visitors and non-admins", anon.status >= 300 && anon.status < 400 && (other.status === 403 || (other.status >= 300 && other.status < 400)) && !otherBody.includes("published"), `signed-out ${anon.status}, non-admin ${other.status}`);

  admin = await sessionFor(env.ADMIN_EMAIL);
  const noTab = await fetch(SITE + "/admin/content/export", { redirect: "manual", headers: { Cookie: admin.cookieHeader } });
  const noTabBody = await noTab.text();
  t.rec("The admin's cookies WITHOUT the tab proof get no export (sent to the unlock page)", noTab.status >= 300 && noTab.status < 400 && /\/admin\/unlock/.test(noTab.headers.get("location") ?? "") && !noTabBody.includes("published"), `HTTP ${noTab.status}`);
  const tabbed = await claimTab(admin);
  const r = await fetch(SITE + "/admin/content/export", { headers: tabbed.headers });
  const body = r.status === 200 ? await r.json() : null;
  const keys = (await c.rows("select key from public.content_published order by 1")).map((x) => x.key);
  t.rec("Admin export downloads every published block (plus drafts) as JSON, never cached",
    r.status === 200 && /attachment; filename="site-content-/.test(r.headers.get("content-disposition") ?? "") && /no-store/.test(r.headers.get("cache-control") ?? "") && JSON.stringify(Object.keys(body?.published ?? {}).sort()) === JSON.stringify(keys) && Array.isArray(body?.drafts ?? null) === false,
    `HTTP ${r.status}, blocks ${Object.keys(body?.published ?? {}).length}/${keys.length}`);
} catch (e) {
  t.rec("Test run completed", false, redact(e.message));
} finally {
  await admin?.signOut().catch(() => {});
  await outsider?.signOut().catch(() => {});
  await cleanup(c);
  await c.end();
  t.done();
}
