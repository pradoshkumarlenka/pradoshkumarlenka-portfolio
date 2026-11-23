// 07 — Site content editor (/admin/content) in a real browser.
// Needs the site running. Uses a test-only admin session (no email sent) and a
// zztest non-admin account. Works on DRAFTS of the footer and contact blocks
// only, and refuses to run if a real draft exists for them (never destroys
// the owner's work). Drafts are never visible to visitors; all test drafts are
// removed at the end. Published content is checked to be unchanged.
//   --publish  also runs ONE real publish of content identical to what is
//              live (version +1, visible site unchanged, recorded in history).
import { SITE, browser, cleanup, createTestUser, db, env, redact, reporter, requireSite, sessionFor, until, wait } from "./lib.mjs";

await requireSite();
const t = reporter("07 · Site content editor (drafts, validation, publish)");
const PUBLISH = process.argv.includes("--publish");
const c = await db();
await cleanup(c);
const q = c.rows;
const pubState = async () => Object.fromEntries((await q("select key, version, content_hash from public.content_published order by 1")).map((r) => [r.key, `${r.version}:${r.content_hash}`]));
const draftOf = async (k) => (await q("select data, base_version from public.content_drafts where key=$1", [k]))[0] ?? null;
const b = await browser();
let admin, outsider, touched = false;
try {
  const existing = (await q("select key from public.content_drafts where key in ('footer','contact')")).map((r) => r.key);
  if (existing.length) throw new Error(`a real draft exists for ${existing.join(", ")} — not touching it; publish or discard it first`);
  const startPub = await pubState();

  // signed out / non-admin
  const v = await (await b.createBrowserContext()).newPage();
  for (const p of ["/admin/content", "/admin/content/footer"]) { await v.goto(SITE + p, { waitUntil: "domcontentloaded" }); if (new URL(v.url()).pathname !== "/admin/login") throw new Error(`signed-out ${p} not redirected`); }
  t.rec("Signed-out visitors are sent to /admin/login", true);
  const u = await createTestUser("content-editor");
  outsider = await sessionFor(u.email);
  const o = await (await b.createBrowserContext()).newPage();
  await o.setCookie(...outsider.cookies);
  await o.goto(SITE + "/admin/content/footer", { waitUntil: "domcontentloaded" });
  t.rec("A confirmed non-admin account is refused the content editor", new URL(o.url()).pathname === "/admin/login" && new URL(o.url()).search.includes("not-admin"));

  // admin
  admin = await sessionFor(env.ADMIN_EMAIL);
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  const consoleErrors = [];
  p.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  p.on("pageerror", (e) => consoleErrors.push(e.message));
  p.on("dialog", (d) => d.accept());
  await p.setCookie(...admin.cookies);
  await p.goto(SITE + "/admin/content", { waitUntil: "load" });
  const rows = await p.$$eval("main li a[href^='/admin/content/']", (as) => [...new Set(as.map((a) => a.getAttribute("href")))]);
  const nBlocks = (await q("select count(*)::int n from (select unnest(array['site','sections','hero','proof','experience','research','leadership','honours','beyond','resume','contact','footer','ui','design','animation','projects'])) k"))[0].n;
  t.rec(`Content dashboard lists all ${nBlocks} blocks`, rows.length === nBlocks, rows.join(" "));

  await p.goto(SITE + "/admin/content/footer", { waitUntil: "load" });
  const footer = (await q("select data from public.content_published where key='footer'"))[0].data;
  const vals = await p.evaluate(() => ({ c: document.getElementById("f_copyright")?.value, s: document.getElementById("f_signoff")?.value, b: document.getElementById("f_backToTop")?.value }));
  t.rec("Footer form shows the published values", vals.c === footer.copyright && vals.s === footer.signoff && vals.b === footer.backToTop, JSON.stringify(vals));

  // Wait until React has hydrated the form (typing earlier would be reset by hydration).
  const hydrated = (sel) => p.waitForFunction((x) => { const el = document.querySelector(x); return el && Object.keys(el).some((k) => k.startsWith("__reactProps")); }, { timeout: 60000 }, sel);
  const click = (text) => p.evaluate((txt) => { const el = [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === txt && !x.disabled); if (!el) return false; el.click(); return true; }, text);
  const status = () => p.evaluate(() => [...document.querySelectorAll("[role=status],[role=alert]")].map((e) => e.textContent).join(" | "));

  // edit → save draft
  touched = true;
  await hydrated("#f_signoff");
  await p.focus("#f_signoff");
  await p.keyboard.press("End");
  await p.keyboard.type(" zztest");
  const saved = await click("Save draft");
  const d1 = await until(async () => { const d = await draftOf("footer"); return d?.data?.signoff?.endsWith(" zztest") ? d : null; }, 40);
  const pub1 = await pubState();
  const home = await (await fetch(SITE + "/")).text();
  t.rec("Save draft stores the change privately (draft row, base version recorded); live content and site unchanged",
    saved && d1 && d1.base_version === Number(startPub.footer.split(":")[0]) && JSON.stringify(pub1) === JSON.stringify(startPub) && !home.includes(footer.signoff + " zztest"),
    `${await status()} · draft ${JSON.stringify(d1 && { base: d1.base_version, signoff: d1.data.signoff })} · live unchanged ${JSON.stringify(pub1) === JSON.stringify(startPub)} · site clean ${!home.includes(footer.signoff + " zztest")}`);

  // the page refreshes after saving: wait for the draft controls before continuing
  await p.waitForFunction(() => [...document.querySelectorAll("button")].some((x) => x.textContent.trim() === "Discard draft"), { timeout: 60000 });
  // invalid content via JSON mode
  const setJson = async (obj) => {
    // The error status can show before the previous save's transition ends ("Working…" = buttons disabled).
    await until(async () => !(await p.evaluate(() => document.body.innerText.includes("Working…"))), 60);
    // Switch only if needed: re-clicking the active JSON tab re-fills the textarea, which can race the text set below.
    if (!(await p.$("#json"))) await click("JSON (advanced)");
    await p.waitForSelector("#json");
    await wait(300);
    await p.$eval("#json", (el, text) => {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    }, JSON.stringify(obj, null, 2));
  };
  await setJson({ ...footer, injected: "<script>alert(1)</script>" });
  await click("Save draft");
  await until(async () => /Unknown field/.test(await status()), 30);
  const d2 = await draftOf("footer");
  t.rec("Unknown fields are rejected on the server; the saved draft is unchanged", /Unknown field/.test(await status()) && d2?.data?.signoff === d1?.data?.signoff && !("injected" in (d2?.data ?? {})), (await status()).slice(0, 160));
  await click("Undo unsaved changes");

  // dangerous link on contact
  await p.goto(SITE + "/admin/content/contact", { waitUntil: "load" });
  await hydrated("button[role=tab]");
  const contact = (await q("select data from public.content_published where key='contact'"))[0].data;
  await setJson({ ...contact, links: contact.links.map((l, i) => (i === 0 ? { ...l, href: "javascript:alert(document.cookie)" } : l)) });
  await click("Save draft");
  await until(async () => /not allowed/.test(await status()), 30);
  t.rec("javascript: links are rejected; no draft is created", /not allowed/.test(await status()) && (await draftOf("contact")) === null, (await status()).slice(0, 160));
  await setJson({ ...contact, headshot: "https://evil.example/x.png" });
  await click("Save draft");
  await until(async () => /inside \/public/.test(await status()), 30);
  t.rec("External image paths are rejected (only files inside /public)", /inside \/public/.test(await status()) && (await draftOf("contact")) === null, (await status()).slice(0, 200) + ` draft=${(await draftOf("contact")) !== null}`);

  // discard footer draft
  await p.goto(SITE + "/admin/content/footer", { waitUntil: "load" });
  await hydrated("#f_signoff");
  const sOff = await p.$eval("#f_signoff", (e) => e.value);
  await click("Discard draft");
  const gone = await until(async () => (await draftOf("footer")) === null, 40);
  t.rec("The editor opens the saved draft; Discard removes it and the published version stays", sOff.endsWith(" zztest") && gone && JSON.stringify(await pubState()) === JSON.stringify(startPub));

  // phone width
  await p.setViewport({ width: 375, height: 800 });
  await p.goto(SITE + "/admin/content/honours", { waitUntil: "load" });
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  t.rec("Editor works at phone width (no horizontal scrolling) and the largest block renders", overflow <= 1 && (await p.$$("input, textarea, select")).length > 20, `overflow ${overflow}px`);
  await p.setViewport({ width: 1280, height: 900 });

  if (PUBLISH) {
    // One real publish of content identical to what is live.
    await p.goto(SITE + "/admin/content/footer", { waitUntil: "load" });
    await hydrated("#f_signoff");
    await click("Save draft");
    await until(async () => (await draftOf("footer")) !== null, 40);
    await p.reload({ waitUntil: "load" });
    await hydrated("#note");
    await p.type("#note", "Automated check: publish identical content (no visible change)");
    await click("Publish");
    const after = await until(async () => { const s = await pubState(); return s.footer !== startPub.footer ? s : null; }, 40);
    const [vOld, hOld] = startPub.footer.split(":"); const [vNew, hNew] = (after?.footer ?? ":").split(":");
    const hist = (await q("select source, note from public.content_versions where key='footer' order by id desc limit 1"))[0];
    const html = await (await fetch(SITE + "/")).text();
    t.rec("Publish (UI): new version, identical content, history 'publish' with the note, draft cleared, site still shows the footer",
      Number(vNew) === Number(vOld) + 1 && hNew === hOld && hist?.source === "publish" && /Automated check/.test(hist?.note ?? "") && (await draftOf("footer")) === null && html.includes(footer.signoff), `v${vOld}→v${vNew}`);
  }

  t.rec("No console errors in the editor", consoleErrors.length === 0, consoleErrors.slice(0, 3).join(" | "));
  if (!PUBLISH) t.rec("Published content unchanged by the test", JSON.stringify(await pubState()) === JSON.stringify(startPub));
} catch (e) {
  t.rec("Test run completed", false, redact(e.message));
} finally {
  if (touched) await c.query("delete from public.content_drafts where key in ('footer','contact')").catch(() => {});
  await admin?.signOut().catch(() => {});
  await outsider?.signOut().catch(() => {});
  await b.close();
  await cleanup(c);
  await c.end();
  await wait(10);
  t.done();
}
