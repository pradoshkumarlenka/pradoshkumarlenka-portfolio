// 04 — Public site ↔ database: listing, detail pages, attachments, drafts, secrets.
// Needs the site running. Uses zztest- items only; never modifies real items.
// Note: against a production build (SITE=…), direct database changes can take up to
// 60 s to appear (page cache). Dashboard changes appear immediately (tested in 03/manual).
import fs from "node:fs";
import path from "node:path";
import { ROOT, SECRET_VALUES, SITE, browser, cleanup, createTestItem, db, putFixture, redact, reporter, requireSite, wait } from "./lib.mjs";

await requireSite();
const t = reporter("04 · Public Research & Selected Work");
const c = await db();
await cleanup(c);
const leaks = [];
const get = async (u) => {
  const r = await fetch(SITE + u, { redirect: "manual" });
  const text = (r.headers.get("content-type") ?? "").includes("text") ? await r.text() : "";
  if (SECRET_VALUES.some((s) => text.includes(s))) leaks.push(u);
  return { status: r.status, text, location: r.headers.get("location"), headers: r.headers };
};
const b = await browser();
const pdf = fs.readFileSync(path.join(ROOT, "public/resumes/Pradosh_Kumar_Lenka_Resume_Master.pdf"));
try {
  const real = (await c.rows("select slug from public.items where state='published' and slug not like 'zztest-%' order by sort_order, created_at")).map((r) => r.slug);
  const pub = await createTestItem(c, "public-new", { state: "published", summary: "Test summary", description: "One.\n\nTwo.", highlights: ["A", "B"], work_status: "In review", sort_order: 999999 });
  const draft = await createTestItem(c, "public-draft", { state: "draft" });
  const arch = await createTestItem(c, "public-arch", { state: "archived" });
  const ids = {};
  for (const [k, ext, type, body] of [["pdf", "pdf", "application/pdf", pdf], ["pptx", "pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", Buffer.from("PK\u0003\u0004")]]) {
    const pth = await putFixture(c, pub, `test.${ext}`, body, type);
    ids[k] = (await c.rows("insert into public.attachments (item_id, title, kind, storage_path, size_bytes) values ($1,$2,$3,$4,$5) returning id", [pub, `Test ${k}`, k, pth, body.length]))[0].id;
  }
  const dp = await putFixture(c, draft, "d.pdf", pdf, "application/pdf");
  ids.draft = (await c.rows("insert into public.attachments (item_id, title, kind, storage_path, size_bytes) values ($1,'d','pdf',$2,$3) returning id", [draft, dp, pdf.length]))[0].id;
  const ap = await putFixture(c, arch, "a.pdf", pdf, "application/pdf");
  ids.arch = (await c.rows("insert into public.attachments (item_id, title, kind, storage_path, size_bytes) values ($1,'a','pdf',$2,$3) returning id", [arch, ap, pdf.length]))[0].id;

  const home = await get("/");
  const lp = await (await b.createBrowserContext()).newPage();
  await lp.goto(SITE + "/", { waitUntil: "load", timeout: 120000 });
  const slugs = await lp.evaluate(() => [...document.querySelectorAll("#research-work .grid > a")].map((a) => a.getAttribute("href").split("/").pop()));
  t.rec("Listing shows the published items in database order (real items first, then the test item)", JSON.stringify(slugs.filter((s) => real.includes(s) || s.startsWith("zztest-"))) === JSON.stringify([...real, "zztest-public-new"]), slugs.join(" "));
  t.rec("Drafts and archived items never listed", !slugs.includes("zztest-public-draft") && !slugs.includes("zztest-public-arch"));
  t.rec("‘Explore Work’ on the cards", (home.text.match(/Explore Work/g) ?? []).length >= real.length + 1);
  const page = await get("/work/zztest-public-new");
  t.rec("A new item gets its own page", page.status === 200 && page.text.includes("ZZTEST public-new"));
  const p = await (await b.createBrowserContext()).newPage();
  await p.goto(SITE + "/work/zztest-public-new", { waitUntil: "load" });
  const labels = await p.evaluate(() => [...document.querySelectorAll("article li")].map((li) => li.innerText.replace(/\s+/g, " ")).join(" | "));
  t.rec("File-specific labels (Read Report / View Presentation)", /Read Report/.test(labels) && /View Presentation/.test(labels), labels.slice(0, 160));
  const pdfLink = await get(`/work-media/file/${ids.pdf}`);
  const dl = await get(`/work-media/file/${ids.pptx}`);
  const signed = await fetch(pdfLink.location);
  t.rec("Published files open via a server-signed link (PDF inline, Office as download)", pdfLink.status === 302 && signed.ok && (await signed.text()).startsWith("%PDF") && dl.status === 302 && /download=/.test(dl.location));
  const tok = new URL(pdfLink.location).searchParams.get("token");
  const claims = JSON.parse(Buffer.from(tok.split(".")[1], "base64url").toString());
  t.rec("Signed links expire after 60 seconds", claims.exp - claims.iat === 60);
  t.rec("File redirects are never cached", /no-store/.test(pdfLink.headers.get("cache-control") ?? ""));
  const blocked = await Promise.all(["/work/zztest-public-draft", "/work/zztest-public-arch", `/work-media/file/${ids.draft}`, `/work-media/file/${ids.arch}`, `/work-media/cover/${draft}`, `/work-media/cover/${arch}`].map(async (u) => (await get(u)).status));
  t.rec("Draft/archived pages, files and covers return 404", blocked.every((s) => s === 404), blocked.join(","));
  const rich = await get(`/projects/${real.find((s) => s !== "securitization-x-ray")}`);
  t.rec("Rich detail pages still render their full layout", rich.status === 200 && rich.text.includes('id="case-results"'));
  t.rec("Unknown slugs return 404", (await get("/work/zztest-does-not-exist")).status === 404 && (await get("/projects/zztest-nope")).status === 404);
  t.rec("Visitors cannot open the dashboard", (await get("/admin")).status === 307);
  for (const [w, h] of [[375, 812], [430, 932], [768, 1024], [1440, 900]]) {
    const r = await (await b.createBrowserContext()).newPage();
    await r.setViewport({ width: w, height: h, isMobile: w < 1024, hasTouch: w < 1024 });
    const o = [];
    for (const u of ["/", "/work/zztest-public-new"]) { await r.goto(SITE + u, { waitUntil: "load", timeout: 120000 }); await wait(500); o.push(await r.evaluate(() => document.documentElement.scrollWidth - innerWidth)); }
    t.rec(`${w}px: no horizontal overflow`, o.every((x) => x <= 0), o.join(","));
    await r.close();
  }
  t.rec("No secret appears in any fetched page or response", leaks.length === 0, leaks.join(","));
} catch (e) {
  t.rec("Test run completed", false, redact(e.message));
} finally {
  await b.close().catch(() => {});
  await cleanup(c);
  await c.end();
  t.done();
}
