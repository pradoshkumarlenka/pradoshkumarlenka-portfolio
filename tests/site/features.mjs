// npm run test:site — new public-site features in a real browser (site running).
// Hero name progressive enhancement, intro loader, page transition, résumé selector
// (via the admin draft preview), analytics scoping, SEO metadata, health check, 404.
// Read-only for the database except a temporary preview session (no email sent).
import { createRequire } from "node:module";
import path from "node:path";
import { ROOT, SITE, browser, env, redact, reporter, requireSite, sessionFor, until, wait } from "../security/lib.mjs";

await requireSite();
const t = reporter("Site features (hero name, loader, transitions, résumé, analytics, SEO)");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");
const b = await browser();
let admin;
const namePixels = async (p) => {
  const r = await p.evaluate(() => { const e = document.querySelector(".hero-name").getBoundingClientRect(); return { x: e.left, y: e.top, width: e.width, height: e.height }; });
  const { data, info } = await sharp(await p.screenshot({ clip: r, captureBeyondViewport: false })).raw().toBuffer({ resolveWithObject: true });
  let n = 0; for (let i = 0; i < data.length; i += info.channels) if (data[i] > 200 && data[i + 1] > 200 && data[i + 2] > 200) n++;
  return n;
};
const fresh = async (opts = {}) => {
  const ctx = await b.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: opts.w ?? 1440, height: opts.h ?? 900, isMobile: (opts.w ?? 1440) < 800, hasTouch: (opts.w ?? 1440) < 800 });
  if (opts.motion) await p.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: opts.motion }]);
  if (opts.noJs) await p.setJavaScriptEnabled(false);
  if (opts.seen) await p.evaluateOnNewDocument(() => { try { localStorage.setItem("pkl-intro", "seen"); } catch {} });
  await p.bringToFront(); // background tabs pause CSS animations and throttle timers
  return p;
};
try {
  // ---- Hero name
  const html = await (await fetch(SITE + "/")).text();
  t.rec("The hero name is real text in the server HTML (no JavaScript needed)", /class="hero-name-text"><span>Pradosh Kumar<\/span><span>Lenka<\/span>/.test(html));
  const nojs = await fresh({ noJs: true, seen: true });
  await nojs.goto(SITE + "/", { waitUntil: "load" });
  await wait(1200);
  const nojsPx = await namePixels(nojs);
  t.rec("With JavaScript disabled the name still appears (CSS reveal)", nojsPx > 2000, `${nojsPx} px`);
  const shots = [];
  for (const [w, h, motion] of [[1440, 900, "reduce"], [768, 1024, "reduce"], [375, 812, "reduce"], [1440, 900, "no-preference"], [375, 812, "no-preference"]]) {
    const p = await fresh({ w, h, motion, seen: true });
    await p.goto(SITE + "/", { waitUntil: "networkidle2", timeout: 120000 });
    await wait(motion === "reduce" ? 800 : 3000);
    const mode = await p.evaluate(() => document.querySelector(".hero-name")?.dataset.mode);
    const px = await namePixels(p);
    shots.push({ w, motion, mode, px, ok: px > (w < 800 ? 2500 : 9000) && (mode === "painted" || mode === "intro") });
  }
  t.rec("Name visible at desktop, tablet and phone, with and without reduced motion; the canvas has taken over", shots.every((s) => s.ok), shots.map((s) => `${s.w}/${s.motion}:${s.mode}:${s.px}`).join(" "));
  const cls = await fresh({ w: 390, h: 844, seen: true });
  await cls.evaluateOnNewDocument(() => { window.__cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: "layout-shift", buffered: true }); });
  await cls.goto(SITE + "/", { waitUntil: "networkidle2" });
  await wait(3000);
  const clsValue = await cls.evaluate(() => window.__cls);
  t.rec("No layout shift while the name and hero load (CLS < 0.01)", clsValue < 0.01, clsValue.toFixed(4));

  // ---- Intro loader
  const first = await fresh({ motion: "no-preference" });
  await first.goto(SITE + "/", { waitUntil: "domcontentloaded" });
  const during = await first.evaluate(() => { const l = document.querySelector(".intro-loader"); const cs = l && getComputedStyle(l); return { intro: document.documentElement.dataset.intro, shown: Boolean(l) && cs.display !== "none", pe: cs?.pointerEvents, hidden: l?.getAttribute("aria-hidden"), focusables: l ? l.querySelectorAll("a,button,input,[tabindex]").length : -1 }; });
  await wait(1800);
  const after = await first.evaluate(() => { const l = document.querySelector(".intro-loader"); return { intro: document.documentElement.dataset.intro, gone: !l || getComputedStyle(l).display === "none" || getComputedStyle(l).visibility === "hidden" }; });
  await first.reload({ waitUntil: "domcontentloaded" });
  const repeat = await first.evaluate(() => ({ intro: document.documentElement.dataset.intro, shown: getComputedStyle(document.querySelector(".intro-loader")).display !== "none" }));
  t.rec("Intro loader plays on the first visit only, is click-through, hidden from assistive tech, has nothing focusable, and is gone within 1.8 s",
    during.intro === "play" && during.shown && during.pe === "none" && during.hidden === "true" && during.focusables === 0 && after.gone && repeat.intro === "skip" && !repeat.shown, JSON.stringify({ during, after, repeat }));
  const rm = await fresh({ motion: "reduce" });
  await rm.goto(SITE + "/", { waitUntil: "domcontentloaded" });
  const rmIntro = await rm.evaluate(() => ({ intro: document.documentElement.dataset.intro, shown: getComputedStyle(document.querySelector(".intro-loader")).display !== "none" }));
  const deep = await fresh({ motion: "no-preference" });
  await deep.goto(SITE + "/projects/dfi-bond-portfolio", { waitUntil: "domcontentloaded" });
  const deepIntro = await deep.evaluate(() => document.documentElement.dataset.intro);
  t.rec("No intro with reduced motion, or when the first page opened is not the home page", rmIntro.intro === "skip" && !rmIntro.shown && deepIntro === "skip");

  // ---- Page transition
  const nav = await fresh({ motion: "no-preference", seen: true });
  await nav.goto(SITE + "/", { waitUntil: "networkidle2" });
  const href = await nav.evaluate(() => [...document.querySelectorAll("a[href^='/projects/']")].map((a) => a.getAttribute("href"))[0]);
  const t0 = Date.now();
  await nav.evaluate((h) => document.querySelector(`a[href='${h}']`).click(), href);
  await until(async () => (await nav.evaluate(() => location.pathname)) === href, 40);
  const navMs = Date.now() - t0;
  const wipe = await until(async () => nav.evaluate(() => { const w = document.querySelector(".page-wipe"); return w ? { pe: getComputedStyle(w).pointerEvents } : null; }), 20);
  await wait(900);
  const focused = await nav.evaluate(() => document.activeElement?.id);
  const wipeGone = await nav.evaluate(() => { const w = document.querySelector(".page-wipe"); return !w || getComputedStyle(w).visibility === "hidden"; });
  await nav.goBack({ waitUntil: "networkidle2" });
  const back = await nav.evaluate(() => location.pathname);
  t.rec("Page transition: navigation is not delayed, the wipe is click-through and finishes, focus moves to the new page's main region, Back works",
    Boolean(wipe) && wipe.pe === "none" && wipeGone && focused === "main" && back === "/" && navMs < 8000, JSON.stringify({ navMs, wipe, focused, back }));
  const navRm = await fresh({ motion: "reduce", seen: true });
  await navRm.goto(SITE + "/", { waitUntil: "networkidle2" });
  await navRm.evaluate((h) => document.querySelector(`a[href='${h}']`).click(), href);
  await until(async () => (await navRm.evaluate(() => location.pathname)) === href, 40);
  await wait(200);
  t.rec("No page-transition animation with reduced motion", !(await navRm.evaluate(() => document.querySelector(".page-wipe") && getComputedStyle(document.querySelector(".page-wipe")).display !== "none")));

  // ---- Analytics scoping
  const pub = await fresh({ seen: true });
  await pub.goto(SITE + "/", { waitUntil: "networkidle2" });
  const pubScript = await pub.evaluate(() => [...document.scripts].some((s) => /\/_vercel\/insights\/script\.js/.test(s.src)));
  admin = await sessionFor(env.ADMIN_EMAIL);
  const adm = await fresh({ seen: true });
  await adm.setCookie(...admin.cookies);
  await adm.goto(SITE + "/admin/content", { waitUntil: "networkidle2" });
  const admScript = await adm.evaluate(() => [...document.scripts].some((s) => /_vercel\/insights/.test(s.src)));
  // Analytics only loads when ENABLE_VERCEL_ANALYTICS=1 at build time (set in Vercel when Web Analytics is
  // switched on). Locally it must be absent, so no failing script request or console error appears.
  const analyticsOn = process.env.ENABLE_VERCEL_ANALYTICS === "1";
  const pubErrors = [];
  const errPage = await fresh({ seen: true });
  errPage.on("console", (m) => { if (m.type() === "error") pubErrors.push(m.text()); });
  await errPage.goto(SITE + "/", { waitUntil: "networkidle2" });
  await wait(1500);
  t.rec(analyticsOn ? "Analytics loads on public pages only (never in the admin)" : "Analytics is off until enabled: no analytics script and no console errors on public pages; never in the admin",
    (analyticsOn ? pubScript : !pubScript && pubErrors.length === 0) && !admScript, `public ${pubScript}, admin ${admScript}, console errors ${pubErrors.length}`);

  // ---- Résumé selector (staged draft, seen through the admin preview)
  // Drafts are visible only in the admin's own tab: check them inside the preview iframe.
  await adm.goto(SITE + "/admin/preview?path=/", { waitUntil: "load" });
  await adm.waitForFunction(() => [...document.querySelectorAll("button")].some((x) => x.textContent.trim() === "Start preview" && Object.keys(x).some((k) => k.startsWith("__react"))), { timeout: 60000 });
  await adm.evaluate(() => [...document.querySelectorAll("button")].find((x) => x.textContent.trim() === "Start preview").click());
  const pv = await until(async () => { const f = adm.frames().find((x) => x !== adm.mainFrame()); if (!f) return null; try { return (await f.evaluate(() => document.querySelectorAll("#resume [role=radio]").length)) ? f : null; } catch { return null; } }, 80);
  const radios = await until(async () => pv.evaluate(() => { const r = [...document.querySelectorAll("#resume [role=radio]")]; return r.length ? r.map((x) => `${x.textContent.trim()}|${x.getAttribute("aria-checked")}|${x.tabIndex}`) : null; }), 40);
  const masterDl = await pv.evaluate(() => { const a = [...document.querySelectorAll("#resume a[download]")][0]; return a ? { href: a.getAttribute("href"), name: a.getAttribute("download") } : null; });
  // Sections below the Hero hydrate one by one (each is a Suspense boundary): wait until the
  // selector is interactive before using the keyboard, as a real visitor's first keypress would.
  await pv.waitForFunction(() => { const r = document.querySelector("#resume [role=radio][aria-checked=true]"); return r && Object.keys(r).some((k) => k.startsWith("__react")); }, { timeout: 30000 });
  await pv.focus("#resume [role=radio][aria-checked=true]");
  await adm.keyboard.press("ArrowRight");
  const afterKey = await pv.evaluate(() => ({ checked: document.querySelector("#resume [role=radio][aria-checked=true]")?.textContent.trim(), focused: document.activeElement?.textContent.trim(), awaiting: document.querySelector("#resume [role=status]")?.textContent, downloads: document.querySelectorAll("#resume a[download]").length }));
  await pv.evaluate(() => [...document.querySelectorAll("#resume button")].find((x) => /Master/.test(x.textContent) && x.getAttribute("role") !== "radio")?.click());
  const backToMaster = await pv.evaluate(() => document.querySelector("#resume [role=radio][aria-checked=true]")?.textContent.trim());
  const pdf = masterDl ? await fetch(SITE + masterDl.href) : null;
  t.rec("Résumé selector: six role versions, keyboard arrows move the selection, awaiting versions are labelled honestly with no download, the Master downloads with its real file name",
    radios?.length === 6 && /^Master/.test(radios[0]) && masterDl?.name === "Pradosh_Kumar_Lenka_Resume_Master.pdf" && pdf?.status === 200 && afterKey.checked?.startsWith("Research") && afterKey.focused?.startsWith("Research") && /being prepared/.test(afterKey.awaiting ?? "") && afterKey.downloads === 0 && backToMaster?.startsWith("Master"),
    JSON.stringify({ afterKey, backToMaster, pdf: pdf?.status }));
  // Visitors (no preview) must never see the staged draft — neither from the database nor from the bundled fallback.
  const visitorHtml = await (await fetch(SITE + "/")).text();
  const fallback = JSON.parse((await import("node:fs")).readFileSync(path.join(ROOT, "content", "resume.json"), "utf8"));
  t.rec("Draft content is never public: visitors get no résumé selector, and the bundled fallback holds only published content", !/role="radiogroup"[^>]*aria-labelledby="resume-choose"/.test(visitorHtml) && !/Choose the résumé/.test(visitorHtml) && !fallback.variants);
  const pvAnalytics = await pv.evaluate(() => [...document.scripts].some((s) => /_vercel\/insights/.test(s.src)));
  t.rec("Analytics never loads during the admin's draft preview", !pvAnalytics);
  await adm.goto(SITE + "/admin/preview", { waitUntil: "load" });
  if (await adm.$("form[action='/admin/preview/exit'] button")) await Promise.all([adm.waitForNavigation({ waitUntil: "load" }), adm.click("form[action='/admin/preview/exit'] button")]);

  // ---- SEO, health, errors
  const proj = await (await fetch(SITE + "/projects/dfi-bond-portfolio")).text();
  const meta = (h, re) => (h.match(re) ?? [])[1];
  const seo = {
    homeCanonical: meta(html, /<link rel="canonical" href="([^"]+)"/),
    projCanonical: meta(proj, /<link rel="canonical" href="([^"]+)"/),
    projTitle: meta(proj, /<title>([^<]+)<\/title>/),
    homeTitle: meta(html, /<title>([^<]+)<\/title>/),
    twitter: meta(html, /<meta name="twitter:card" content="([^"]+)"/),
    projOg: meta(proj, /<meta property="og:title" content="([^"]+)"/),
    ogImage: /<meta property="og:image" content="[^"]+opengraph-image/.test(proj),
    jsonLd: /"@type":"Person"/.test(html),
  };
  t.rec("SEO: unique titles, canonical URLs per page, Open Graph + Twitter large card, social image, Person structured data",
    new URL(seo.homeCanonical ?? "x:").pathname === "/" && seo.projCanonical?.endsWith("/projects/dfi-bond-portfolio") && seo.projTitle !== seo.homeTitle && seo.twitter === "summary_large_image" && Boolean(seo.projOg) && seo.ogImage && seo.jsonLd, JSON.stringify(seo).slice(0, 300));
  const robots = await (await fetch(SITE + "/robots.txt")).text();
  const sitemap = await (await fetch(SITE + "/sitemap.xml")).text();
  const adminHead = await (await fetch(SITE + "/admin/login")).text();
  t.rec("robots.txt blocks admin, auth, media and health routes; sitemap lists the public pages; admin pages are noindex",
    /Disallow: \/admin/.test(robots) && /Disallow: \/media\//.test(robots) && /Disallow: \/healthz/.test(robots) && (sitemap.match(/<loc>/g) ?? []).length >= 7 && /noindex/.test(adminHead));
  const health = await fetch(SITE + "/healthz");
  const hj = await health.json();
  t.rec("Health check reports status and database reachability, never cached, reveals nothing private", health.status === 200 && hj.status === "ok" && ["ok", "unreachable"].includes(hj.database) && /no-store/.test(health.headers.get("cache-control") ?? "") && Object.keys(hj).join(",") === "status,database,time", JSON.stringify(hj));
  const nf = await fetch(SITE + "/no-such-page-zz");
  const nfHtml = await nf.text();
  t.rec("Unknown routes return a real 404 page with a way home (no technical details)", nf.status === 404 && /href="\/"/.test(nfHtml) && !/at .*\.js:\d+/.test(nfHtml));
} catch (e) {
  t.rec("Test run completed", false, redact(e.message));
} finally {
  await admin?.signOut().catch(() => {});
  await b.close();
  t.done();
}
