// 03 — Admin dashboard: access control, forged requests, item management and uploads.
// Needs the site running (SITE, default http://localhost:3000). Uses a test-only admin
// session (no email sent) and a zztest non-admin account. Only zztest- data is touched.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { ROOT, SITE, browser, cleanup, createTestUser, db, env, redact, reporter, requireSite, sessionFor, until } from "./lib.mjs";

await requireSite();
const t = reporter("03 · Admin dashboard: access control, items and uploads");
const c = await db();
await cleanup(c);
const require = createRequire(path.join(ROOT, "package.json"));
const XLSX = require("xlsx");
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "zztest-"));
const pdf = fs.readFileSync(path.join(ROOT, "public/resumes/Pradosh_Kumar_Lenka_Resume_Master.pdf"));
fs.writeFileSync(path.join(DIR, "Report.pdf"), pdf);
const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["a", 1]]), "S"); XLSX.writeFile(wb, path.join(DIR, "Model.xlsx"));
fs.writeFileSync(path.join(DIR, "fake.pdf"), "MZ not a pdf");
fs.writeFileSync(path.join(DIR, "tool.exe"), "MZ");
const b = await browser();
let admin, outsider;
try {
  // signed out
  const v = await (await b.createBrowserContext()).newPage();
  for (const p of ["/admin", "/admin/items/new"]) { await v.goto(SITE + p, { waitUntil: "domcontentloaded" }); if (new URL(v.url()).pathname !== "/admin/login") throw new Error(`signed-out ${p} not redirected`); }
  t.rec("Signed-out visitors are sent to /admin/login", true, "/admin and /admin/items/new");
  const head = await fetch(SITE + "/admin/login");
  t.rec("Admin pages are not cached and not indexed", /no-store/.test(head.headers.get("cache-control") ?? "") && /noindex/.test(await head.text()));

  // non-admin account
  const u = await createTestUser("dashboard");
  outsider = await sessionFor(u.email);
  const o = await (await b.createBrowserContext()).newPage();
  await o.setCookie(...outsider.cookies);
  await o.goto(SITE + "/admin", { waitUntil: "domcontentloaded" });
  t.rec("A confirmed NON-admin account is refused the dashboard", new URL(o.url()).pathname === "/admin/login" && new URL(o.url()).search.includes("not-admin"));

  // admin
  admin = await sessionFor(env.ADMIN_EMAIL);
  const p = await (await b.createBrowserContext()).newPage();
  await p.setCookie(...admin.cookies);
  await p.goto(SITE + "/admin", { waitUntil: "load" });
  t.rec("The administrator session opens the dashboard", (await p.$eval("h1", (e) => e.textContent)) === "Research & Selected Work");

  // create a zztest item through the form and capture the server-action request
  let action;
  await p.setRequestInterception(true);
  p.on("request", (r) => { if (r.method() === "POST" && r.headers()["next-action"] && !action) action = { url: r.url(), headers: r.headers(), body: r.postData() }; if (!r.isInterceptResolutionHandled()) r.continue().catch(() => {}); });
  await p.goto(SITE + "/admin/items/new", { waitUntil: "load" });
  await p.type("#title", "ZZTEST dashboard");
  await p.click("#slug", { clickCount: 3 }); await p.type("#slug", "zztest-dashboard");
  await p.type("#summary", "Test summary");
  await p.click("main button[type=submit]");
  const id = await until(async () => (await c.rows("select id from public.items where slug='zztest-dashboard'"))[0]?.id);
  t.rec("Create item (saved as a private draft)", Boolean(id) && (await c.rows("select state from public.items where id=$1", [id]))[0].state === "draft");
  p.removeAllListeners("request"); await p.setRequestInterception(false);

  // forged replays of the captured create request
  const replay = async (cookie, keepTab = false) => {
    const h = { ...action.headers, cookie: cookie ?? "" }; delete h["content-length"];
    if (!keepTab) delete h["x-admin-tab"];
    await fetch(action.url, { method: "POST", headers: h, body: action.body.replace(/zztest-dashboard/g, "zztest-forged"), redirect: "manual" }).catch(() => {});
    return (await c.rows("select count(*)::int n from public.items where slug='zztest-forged'"))[0].n;
  };
  t.rec("Forged create request without a session writes nothing", (await replay(null)) === 0);
  t.rec("Forged create request with a non-admin session writes nothing", (await replay(outsider.cookieHeader)) === 0);
  const realCookies = (await p.cookies(SITE)).map((x) => `${x.name}=${x.value}`).join("; ");
  t.rec("The admin's real cookies WITHOUT the tab proof (another tab) cannot run the action", Boolean(action.headers["x-admin-tab"]) && (await replay(realCookies)) === 0);
  t.rec("…while the same request from the admin's tab works (control)", (await replay(realCookies, true)) === 1);
  await c.query("delete from public.items where slug='zztest-forged'");

  // publish / unpublish via the UI
  const clickState = async (label, expected) => {
    await p.goto(`${SITE}/admin/items/${id}`, { waitUntil: "load" });
    await p.waitForFunction((l) => [...document.querySelectorAll("main button")].some((x) => x.textContent.trim().startsWith(l)), { timeout: 30000 }, label);
    await p.evaluate((l) => [...document.querySelectorAll("main button")].find((x) => x.textContent.trim().startsWith(l)).click(), label);
    return until(async () => (await c.rows("select state from public.items where id=$1", [id]))[0].state === expected);
  };
  t.rec("Publish and unpublish through the dashboard", (await clickState("Publish", "published")) && (await clickState("Unpublish", "draft")));

  // uploads
  const upload = async (file) => {
    await p.goto(`${SITE}/admin/items/${id}`, { waitUntil: "load" });
    const input = await p.waitForSelector(`#up-attachment-${id}`);
    await input.uploadFile(path.join(DIR, file));
    await p.waitForFunction((f) => [...document.querySelectorAll("main [role=status]")].some((e) => /added/.test(e.textContent) || e.textContent.includes(f + ":")), { timeout: 90000 }, file);
    return p.evaluate(() => [...document.querySelectorAll("main [role=status]")].map((e) => e.textContent).join(" "));
  };
  await upload("Report.pdf"); await upload("Model.xlsx");
  const kinds = (await c.rows("select kind from public.attachments where item_id=$1 order by sort_order", [id])).map((r) => r.kind).join(",");
  t.rec("Real PDF and Excel uploads are verified and attached in the item's own folder", kinds === "pdf,xlsx" && (await c.rows("select count(*)::int n from public.attachments where item_id=$1 and storage_path like $2", [id, `items/${id}/%`]))[0].n === 2, kinds);
  const fake = await upload("fake.pdf");
  const files = (await c.rows("select name from storage.objects where name like $1", [`items/${id}/%`])).map((r) => r.name);
  t.rec("A disguised file is rejected and deleted from storage", /not a real \.pdf/.test(fake) && !files.some((f) => f.includes("fake")), `${files.length} files`);
  t.rec("A disallowed type (.exe) is refused", /Allowed files/.test(await upload("tool.exe")));
} catch (e) {
  t.rec("Test run completed", false, redact(e.message));
} finally {
  await admin?.signOut().catch(() => {});
  await outsider?.signOut().catch(() => {});
  await b.close().catch(() => {});
  await cleanup(c);
  fs.rmSync(DIR, { recursive: true, force: true });
  await c.end();
  t.done();
}
