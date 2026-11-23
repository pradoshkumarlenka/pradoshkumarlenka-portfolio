// 08 — Draft preview (Draft Mode) and version history. Needs the site running.
// Uses a zztest draft of the footer block (refuses to run if a real footer
// draft exists) and removes it at the end. Published content is not changed
// unless --restore is given (then ONE restore of identical content is made).
import { SITE, browser, cleanup, createTestUser, db, env, redact, reporter, requireSite, sessionFor, until, claimTab } from "./lib.mjs";

await requireSite();
const t = reporter("08 · Draft preview and version history");
const RESTORE = process.argv.includes("--restore");
const MARK = "zztest preview signoff";
const c = await db();
await cleanup(c);
const q = c.rows;
const pubState = async () => JSON.stringify(await q("select key, version, content_hash from public.content_published order by 1"));
const b = await browser();
let admin, outsider, made = false;
try {
  if ((await q("select 1 from public.content_drafts where key='footer'")).length) throw new Error("a real footer draft exists — not touching it");
  const start = await pubState();
  const footer = (await q("select data from public.content_published where key='footer'"))[0].data;
  await c.query("insert into public.content_drafts (key, data) values ('footer', $1::jsonb)", [JSON.stringify({ ...footer, signoff: MARK })]);
  made = true;

  // Signed out / non-admin cannot enable Draft Mode.
  const post = (cookie, body = "path=%2F") => fetch(SITE + "/admin/preview/enable", { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", ...(cookie ? { Cookie: cookie } : {}) }, body });
  const anon = await post();
  const u = await createTestUser("preview");
  outsider = await sessionFor(u.email);
  const other = await post(outsider.cookieHeader);
  const bypassSet = (r) => (r.headers.get("set-cookie") ?? "").includes("__prerender_bypass");
  t.rec("Signed-out and non-admin requests cannot turn on preview (no bypass cookie)", !bypassSet(anon) && !bypassSet(other) && anon.status >= 300 && other.status === 403, `signed-out ${anon.status}, non-admin ${other.status}`);

  // Admin preview in the browser.
  admin = await sessionFor(env.ADMIN_EMAIL);
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  p.on("dialog", (d) => d.accept());
  await p.setCookie(...admin.cookies);
  await p.goto(SITE + "/admin/preview?path=/", { waitUntil: "load" });
  await p.waitForFunction(() => [...document.querySelectorAll("button")].some((x) => x.textContent.trim() === "Start preview" && Object.keys(x).some((k) => k.startsWith("__react"))), { timeout: 60000 });
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Start preview").click());
  const bypass = await until(async () => (await p.cookies(SITE)).find((x) => x.name === "__prerender_bypass"), 60);
  const frame = await until(async () => { const f = p.frames().find((x) => x !== p.mainFrame()); if (!f) return null; try { const ok = await f.evaluate((m) => document.body?.innerText.includes(m), MARK); return ok ? f : null; } catch { return null; } }, 120);
  const banner = frame ? await frame.evaluate(() => document.body.innerText.includes("Preview — showing unpublished drafts")) : false;
  t.rec("Admin preview: the real site shows the draft, with the preview banner", Boolean(bypass) && Boolean(frame) && banner, `cookie ${Boolean(bypass)}, draft shown ${Boolean(frame)}, banner ${banner}`);

  // The one-time ?_pv= ticket is removed from the frame's address once loaded, so "Open frame
  // in new tab" (or a copied frame URL) gives another tab no drafts.
  const frameUrl = frame ? await until(async () => { const u = await frame.evaluate(() => location.href); return u.includes("_pv=") ? null : u; }, 20) : null;
  let frameCopy = "";
  if (frameUrl) { const p3 = await ctx.newPage(); await p3.goto(frameUrl, { waitUntil: "load" }); frameCopy = await p3.content(); await p3.close(); }
  t.rec("The preview ticket is stripped from the frame URL; opening that URL in another tab shows no drafts", Boolean(frameUrl) && !frameCopy.includes(MARK) && frameCopy.includes(footer.signoff), frameUrl ?? "ticket still in URL");

  // Visitors — even WITH the admin's bypass cookie — never see drafts.
  const home = await (await fetch(SITE + "/")).text();
  const stolen = await (await fetch(SITE + "/", { headers: { Cookie: `__prerender_bypass=${bypass?.value ?? "x"}` } })).text();
  const forged = await (await fetch(SITE + "/", { headers: { Cookie: `__prerender_bypass=forged; ${outsider.cookieHeader}` } })).text();
  t.rec("Visitors never see drafts — not even with a copied preview cookie or a non-admin session", !home.includes(MARK) && !stolen.includes(MARK) && !forged.includes(MARK) && home.includes(footer.signoff) && stolen.includes(footer.signoff) && !stolen.includes("Preview — showing"));

  // The admin's own cookies (session + preview cookie) WITHOUT the tab proof: no drafts.
  const noTab = await (await fetch(SITE + "/", { headers: { Cookie: `${admin.cookieHeader}; __prerender_bypass=${bypass?.value ?? ""}` } })).text();
  const p2 = await ctx.newPage();
  await p2.goto(SITE + "/", { waitUntil: "load" });
  const otherTab = await p2.content();
  await p2.close();
  t.rec("Another tab, or a request with the admin's cookies but no tab proof, never receives drafts", !noTab.includes(MARK) && !otherTab.includes(MARK) && noTab.includes(footer.signoff));
  const tabbed = await claimTab(await sessionFor(env.ADMIN_EMAIL));

  // Open-redirect attempts fall back to "/".
  const evil = await p.evaluate(async () => {
    const r = await fetch("/admin/preview/enable", { method: "POST", body: new URLSearchParams({ path: "//evil.example/x" }), redirect: "manual" });
    return { status: r.status, type: r.type };
  });
  const evilLoc = await (async () => { const r = await fetch(SITE + "/admin/preview/enable", { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", ...tabbed.headers }, body: "path=https%3A%2F%2Fevil.example" }); return r.headers.get("location") ?? ""; })();
  t.rec("Preview cannot be used as an open redirect", new URL(evilLoc, SITE).origin === new URL(SITE).origin && new URL(evilLoc, SITE).searchParams.get("path") === "/", `${evil.status} → ${evilLoc}`);
  const xorigin = await fetch(SITE + "/admin/preview/enable", { method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", ...tabbed.headers, Origin: "https://evil.example" }, body: "path=%2F" });
  t.rec("Cross-site form posts are refused", xorigin.status === 403, `HTTP ${xorigin.status}`);

  // Design + animation drafts: applied in the admin preview only.
  const ok2 = !(await q("select 1 from public.content_drafts where key in ('design','animation')")).length;
  if (ok2) {
    const design = (await q("select data from public.content_published where key='design'"))[0].data;
    const anim = (await q("select data from public.content_published where key='animation'"))[0].data;
    await c.query("insert into public.content_drafts (key, data) values ('design', $1::jsonb), ('animation', $2::jsonb)", [
      JSON.stringify({ ...design, colors: { ...design.colors, violet: "#b07cff" }, radii: { ...design.radii, card: 20 } }),
      JSON.stringify({ ...anim, global: { smoothScrollLerp: 0.2 } }),
    ]);
    try {
      const html = await (await fetch(SITE + "/", { headers: { ...tabbed.headers, cookie: `${tabbed.cookie}; __prerender_bypass=${bypass?.value ?? ""}` } })).text();
      const pub = await (await fetch(SITE + "/")).text();
      const themed = /<style id="theme-overrides">:root\{--color-violet:#b07cff;--radius-card:20px\}<\/style>/.test(html);
      const lerp = /smoothScrollLerp\\?":0\.2\b/.test(html);
      t.rec("Design and animation drafts apply in the admin preview (CSS variables, motion settings); visitors still get the default theme with no override tag",
        themed && lerp && !pub.includes("theme-overrides") && !/smoothScrollLerp\\?":0\.2\b/.test(pub), `themed ${themed}, lerp ${lerp}`);
    } finally {
      await c.query("delete from public.content_drafts where key in ('design','animation')");
    }
  } else t.rec("Design/animation preview check skipped: real drafts exist", false);

  // Exit.
  await Promise.all([p.waitForNavigation({ waitUntil: "load" }), p.click("form[action='/admin/preview/exit'] button")]);
  const after = (await p.cookies(SITE)).some((x) => x.name === "__prerender_bypass");
  await p.goto(SITE + "/", { waitUntil: "domcontentloaded" });
  const adminHome = await p.content();
  t.rec("Exit preview removes the cookie; the admin then sees the published site", !after && !adminHome.includes(MARK));

  // History page.
  await p.goto(SITE + "/admin/content/footer/history", { waitUntil: "load" });
  const hist = await p.evaluate(() => ({ items: document.querySelectorAll("main ol > li").length, live: /\bLive\b/i.test(document.body.innerText), restore: [...document.querySelectorAll("button")].filter((x) => x.textContent.trim() === "Restore").length }));
  const rows = (await q("select count(*)::int n from public.content_versions where key='footer'"))[0].n;
  t.rec("History lists every version of the block, marks the live one, offers Restore for older ones", hist.items === rows && hist.live && hist.restore === rows - 1, JSON.stringify(hist));

  if (RESTORE) {
    const v0 = (await q("select version, content_hash from public.content_published where key='footer'"))[0];
    const oldest = (await q("select version, content_hash from public.content_versions where key='footer' and operation <> 'DELETE' order by version limit 1"))[0];
    await p.waitForFunction(() => [...document.querySelectorAll("button")].some((x) => x.textContent.trim() === "Restore" && Object.keys(x).some((k) => k.startsWith("__react"))), { timeout: 60000 });
    await p.evaluate(() => [...document.querySelectorAll("button")].filter((x) => x.textContent.trim() === "Restore").pop().click());
    const v1 = await until(async () => { const r = (await q("select version, content_hash from public.content_published where key='footer'"))[0]; return r.version > v0.version ? r : null; }, 60);
    const h = (await q("select source, note from public.content_versions where key='footer' order by id desc limit 1"))[0];
    const msg = await p.evaluate(() => [...document.querySelectorAll("[role=status],[role=alert]")].map((e) => e.textContent).join(" | "));
    t.rec("Restore (UI): oldest version published again as a new version, history 'rollback'", v1 && v1.version === v0.version + 1 && v1.content_hash === oldest.content_hash && h.source === "rollback", JSON.stringify({ from: v0.version, to: v1?.version, src: h.source, msg }));
  } else {
    t.rec("Published content unchanged by the test", (await pubState()) === start);
  }
} catch (e) {
  t.rec("Test run completed", false, redact(e.message));
} finally {
  if (made) await c.query("delete from public.content_drafts where key='footer' and data->>'signoff' = $1", [MARK]).catch(() => {});
  await admin?.signOut().catch(() => {});
  await outsider?.signOut().catch(() => {});
  await b.close();
  await cleanup(c);
  await c.end();
  t.done();
}
