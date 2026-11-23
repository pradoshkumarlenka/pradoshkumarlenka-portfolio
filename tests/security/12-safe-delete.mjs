// 12 — Safe deletion: work items (typed confirmation, published warning + acknowledgement,
// concurrency check, only the selected record, files never auto-deleted) and CMS list entries
// (confirmation, draft-only). Only zztest- items are created/deleted; the CMS check is cancelled.
import { SITE, browser, cleanup, createTestItem, db, env, putFixture, reporter, requireSite, sessionFor, until, wait } from "./lib.mjs";

await requireSite();
const t = reporter("12 · Safe deletion (work items, CMS entries)");
const c = await db();
await cleanup(c);
const b = await browser();
let dialogs = [];
try {
  const admin = await sessionFor(env.ADMIN_EMAIL);
  const p = await (await b.createBrowserContext()).newPage();
  await p.setCookie(...admin.cookies);
  let answer = true;
  p.on("dialog", async (d) => { dialogs.push(d.message()); await (answer ? d.accept() : d.dismiss()); });

  const keep = await createTestItem(c, "delete-keep");
  const id = await createTestItem(c, "delete-live", { state: "published", published_at: new Date().toISOString() });
  const file = await putFixture(c, id, "cover.png", Buffer.from("89504e470d0a1a0a", "hex"), "image/png");
  const objects = async () => (await c.rows("select count(*)::int n from storage.objects where bucket_id='work-files' and name=$1", [file]))[0].n;

  await p.goto(SITE + `/admin/items/${id}`, { waitUntil: "load" });
  await p.waitForSelector("#confirm-delete");
  const text = await p.$eval("main", (e) => e.innerText);
  const btn = () => p.evaluate(() => [...document.querySelectorAll("main button")].find((x) => x.textContent.includes("Delete permanently"))?.disabled);
  await p.type("#confirm-delete", "zztest-delete-live");
  const disabledWithoutAck = await btn();
  t.rec("Published item: live warning shown; button stays disabled until the acknowledgement is ticked", /published/.test(text) && /removes it from the website/.test(text) && disabledWithoutAck === true);

  // concurrency: the item changes after the page was opened → nothing is deleted
  await c.query("update public.items set summary = summary || ' (edited elsewhere)' where id=$1 and slug like 'zztest-%'", [id]);
  await p.click("main input[type=checkbox]");
  await p.evaluate(() => [...document.querySelectorAll("main button")].find((x) => x.textContent.includes("Delete permanently")).click());
  await until(async () => /changed since you opened it/.test(await p.$eval("main", (e) => e.innerText)), 30);
  const stillThere = (await c.rows("select count(*)::int n from public.items where id=$1", [id]))[0].n === 1;
  t.rec("Edited in another tab meanwhile → refused, item kept (concurrency check)", stillThere && dialogs.some((m) => /LIVE/.test(m)));

  // reload (fresh version) → delete works, only this record, files kept
  await p.goto(SITE + `/admin/items/${id}`, { waitUntil: "load" });
  await p.waitForSelector("#confirm-delete");
  await p.type("#confirm-delete", "zztest-delete-live");
  await p.click("main input[type=checkbox]");
  answer = false; // first: cancel the browser confirmation
  await p.evaluate(() => [...document.querySelectorAll("main button")].find((x) => x.textContent.includes("Delete permanently")).click());
  await wait(1500);
  const cancelledKept = (await c.rows("select count(*)::int n from public.items where id=$1", [id]))[0].n === 1;
  answer = true;
  await p.evaluate(() => [...document.querySelectorAll("main button")].find((x) => x.textContent.includes("Delete permanently")).click());
  await until(async () => new URL(p.url()).searchParams.has("deleted"), 40);
  const gone = (await c.rows("select count(*)::int n from public.items where id=$1", [id]))[0].n === 0;
  const others = (await c.rows("select count(*)::int n from public.items where id=$1", [keep]))[0].n === 1;
  t.rec("Cancelling the confirmation deletes nothing", cancelledKept);
  t.rec("Confirmed delete removes only the selected item; its uploaded file is NOT deleted automatically", gone && others && (await objects()) === 1);
  const pub = await fetch(SITE + "/work/zztest-delete-live", { redirect: "manual" });
  t.rec("The deleted item's page is gone from the public site", pub.status === 404);

  // CMS list entry: removing asks first and cancelling keeps the entry
  await p.goto(SITE + "/admin/content/proof", { waitUntil: "load" });
  await p.waitForFunction(() => [...document.querySelectorAll("button")].some((x) => /^Remove/.test(x.getAttribute("aria-label") ?? "")), { timeout: 60000 });
  const count = () => p.evaluate(() => [...document.querySelectorAll("button")].filter((x) => /^Remove entry/.test(x.getAttribute("aria-label") ?? "")).length);
  const before = await count();
  dialogs = [];
  answer = false;
  await p.evaluate(() => [...document.querySelectorAll("button")].find((x) => /^Remove entry/.test(x.getAttribute("aria-label") ?? "")).click());
  await wait(300);
  t.rec("CMS: removing a list entry asks for confirmation (draft-only, media kept) and Cancel keeps it", before > 0 && (await count()) === before && dialogs.some((m) => /only changes your draft/.test(m) && /not deleted/.test(m)));
} catch (e) {
  t.rec("Safe-delete test run", false, e.message);
} finally {
  await b.close();
  await cleanup(c);
  await c.end();
}
t.done();
