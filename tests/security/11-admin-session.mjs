// 11 — Admin session limits and tab binding (src/lib/admin/session-policy.ts, /admin/session,
// SessionGuard). Needs the site running. Uses test-only sessions; the idle/absolute expiry
// checks use a zztest non-admin account (the limits apply before the admin check), so the
// real administrator account is never altered.
import { SITE, browser, cleanup, createTestUser, db, env, reporter, requireSite, sessionFor, signSession, wait, claimTab } from "./lib.mjs";

await requireSite();
const t = reporter("11 · Admin session: idle/absolute limits, tab binding");
const c = await db();
await cleanup(c);
const b = await browser();
const replaceCookie = (header, name, value) => header.split("; ").filter((x) => !x.startsWith(`${name}=`)).concat(value === null ? [] : [`${name}=${value}`]).join("; ");
const get = (p, cookie) => fetch(SITE + p, { redirect: "manual", headers: { cookie } });
const session = (cookie, body, extra = {}) =>
  fetch(SITE + "/admin/session", { method: "POST", redirect: "manual", headers: { cookie, "Content-Type": "application/json", Origin: SITE, ...extra }, body: JSON.stringify(body) });
let admin;
try {
  admin = await sessionFor(env.ADMIN_EMAIL);
  // Server-side tab enforcement: valid admin cookies alone receive no private data.
  const PRIVATE = ["Proof Bar", "Résumé Library", "Research &amp; Selected Work", "content_drafts"];
  const leaks = (html) => PRIVATE.filter((x) => html.includes(x));
  const doc = await get("/admin/content", admin.cookieHeader);
  const rsc = await fetch(SITE + "/admin/content", { redirect: "manual", headers: { cookie: admin.cookieHeader, RSC: "1" } });
  const toUnlock = (r) => r.status >= 300 && r.status < 400 && /\/admin\/unlock\?next=%2Fadmin%2Fcontent/.test(r.headers.get("location") ?? "");
  t.rec("Without the tab proof, admin page loads and RSC (hydration) requests are redirected to the unlock page", toUnlock(doc) && toUnlock(rsc) && !leaks(await doc.text()).length && !leaks(await rsc.text()).length);
  const unlockHtml = await (await get("/admin/unlock?next=%2Fadmin%2Fcontent", admin.cookieHeader)).text();
  t.rec("The unlock page itself contains no private CMS data", /Checking your session/.test(unlockHtml) && !leaks(unlockHtml).length, leaks(unlockHtml).join(", "));
  const forgedTab = await fetch(SITE + "/admin/content", { redirect: "manual", headers: { cookie: admin.cookieHeader, "x-admin-tab": "A".repeat(43) } });
  t.rec("A made-up tab id is not accepted", toUnlock(forgedTab));
  const tabbed = await claimTab(await sessionFor(env.ADMIN_EMAIL));
  const ok = await fetch(SITE + "/admin/content", { redirect: "manual", headers: tabbed.headers });
  t.rec("With the tab proof the page renders, and the request renews the idle timer", ok.status === 200 && /Proof Bar/.test(await ok.text()) && /pkl_admin_act=/.test(ok.headers.get("set-cookie") ?? ""));
  const stolenTab = await fetch(SITE + "/admin/content", { redirect: "manual", headers: { cookie: admin.cookieHeader, "x-admin-tab": tabbed.tabId } });
  t.rec("A tab id is useless without that tab's own cookie", toUnlock(stolenTab));

  // idle timer cookie: missing, forged, stale, other user
  // (each expiry signs that session out, so every probe uses its own fresh session)
  const u = await createTestUser("session");
  const noActS = await sessionFor(u.email), forgedS = await sessionFor(u.email);
  const noAct = await get("/admin", replaceCookie(noActS.cookieHeader, "pkl_admin_act", null));
  const forged = await get("/admin", replaceCookie(forgedS.cookieHeader, "pkl_admin_act", signSession(`act.${forgedS.userId}.${Date.now()}`, "wrong-key")));
  const toExpired = (r) => r.status >= 300 && r.status < 400 && /\/admin\/login\?error=expired/.test(r.headers.get("location") ?? "");
  t.rec("No idle-timer cookie, or one with a forged signature → signed out (expired)", toExpired(noAct) && toExpired(forged));

  const idle = await sessionFor(u.email);
  const stale = replaceCookie(idle.cookieHeader, "pkl_admin_act", signSession(`act.${idle.userId}.${Date.now() - 31 * 60 * 1000}`));
  const r1 = await get("/admin", stale);
  const cleared = (r1.headers.get("set-cookie") ?? "").split(/,(?=\s*[\w-]+=)/).filter((x) => /^\s*sb-[^=]+=;?/.test(x) || /Max-Age=0/i.test(x));
  t.rec("31 minutes idle → signed out: redirect, auth cookies cleared", toExpired(r1) && cleared.length > 0);
  const reuse = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${idle.accessToken}` } });
  const sid = JSON.parse(Buffer.from(idle.accessToken.split(".")[1], "base64url")).session_id;
  t.rec("…and that session is revoked in Supabase (refresh token no longer usable)", (await c.rows("select count(*)::int n from auth.sessions where id=$1", [sid]))[0].n === 0, `access token until its own expiry: ${reuse.status}`);

  const other = await sessionFor(u.email);
  const crossS = await sessionFor(env.ADMIN_EMAIL);
  const crossUser = await get("/admin", replaceCookie(crossS.cookieHeader, "pkl_admin_act", signSession(`act.${other.userId}.${Date.now()}`)));
  t.rec("An idle-timer cookie of another account is rejected", toExpired(crossUser));

  await c.query("update auth.users set last_sign_in_at = now() - interval '13 hours' where id=$1 and email like 'zztest-%@test.invalid'", [other.userId]);
  t.rec("12-hour absolute limit since the email sign-in → signed out, even when active", toExpired(await get("/admin", other.cookieHeader)));

  const staleS = await sessionFor(u.email);
  const stale2 = replaceCookie(staleS.cookieHeader, "pkl_admin_act", signSession(`act.${staleS.userId}.${Date.now() - 31 * 60 * 1000}`));
  const actionExpired = await fetch(SITE + "/admin", { method: "POST", redirect: "manual", headers: { cookie: stale2, "Next-Action": "x" } });
  t.rec("An expired session's server-action POST gets 401 (never runs)", actionExpired.status === 401);

  // tab binding API
  const xo = await session(admin.cookieHeader, { op: "claim" }, { Origin: "https://evil.example" });
  const noGrant = await (await session(replaceCookie(admin.cookieHeader, "pkl_admin_grant", null), { op: "claim" })).json();
  t.rec("Tab claim: cross-origin refused; no grant → refused", xo.status === 403 && noGrant.ok === false);
  const claimRes = await session(admin.cookieHeader, { op: "claim" });
  const claim = await claimRes.json();
  const tabCookie = (claimRes.headers.get("set-cookie") ?? "").match(/pkl_admin_tab=([^;]+)/)?.[1];
  const withTab = replaceCookie(admin.cookieHeader, "pkl_admin_tab", tabCookie);
  const replay = await (await session(withTab, { op: "claim" })).json();
  t.rec("The sign-in grant can be claimed once (a replayed grant is refused)", claim.ok === true && typeof claim.tabId === "string" && Boolean(tabCookie) && replay.ok === false);
  const good = await (await session(withTab, { op: "check", tabId: claim.tabId })).json();
  const bad = await (await session(withTab, { op: "check", tabId: "A".repeat(43) })).json();
  t.rec("Only the claiming tab's id passes the check", good.ok === true && good.idleLeft > 25 * 60 * 1000 && bad.ok === false);
  const passive = await session(withTab, { op: "check", tabId: claim.tabId }, { "x-admin-passive": "1" });
  t.rec("Passive checks do not extend the idle timer", !/pkl_admin_act=/.test(passive.headers.get("set-cookie") ?? ""));

  // browser: same tab refresh keeps access, new tab and duplicated tab are locked
  admin = await sessionFor(env.ADMIN_EMAIL);
  const ctx = await b.createBrowserContext();
  const p1 = await ctx.newPage();
  await p1.setCookie(...admin.cookies);
  await p1.goto(SITE + "/admin", { waitUntil: "load" });
  const h1 = () => p1.$eval("main h1", (e) => e.textContent).catch(() => "");
  const first = await h1();
  await p1.reload({ waitUntil: "load" });
  t.rec("Browser: the sign-in tab shows the dashboard and keeps it after a refresh", first === "Research & Selected Work" && (await h1()) === "Research & Selected Work");
  const p2 = await ctx.newPage();
  await p2.goto(SITE + "/admin/content", { waitUntil: "load" });
  const locked2 = await p2.$eval("main h1", (e) => e.textContent).catch(() => "");
  const leaked = await p2.$eval("main", (e) => e.innerText.includes("Site content") && !e.innerText.includes("locked")).catch(() => false);
  t.rec("Browser: a NEW tab with the same cookies is locked (admin UI not rendered)", locked2 === "Admin locked in this tab" && !leaked);
  // duplicate: copy the first tab's sessionStorage into a new tab (what "Duplicate tab" does)
  const tabId = await p1.evaluate(() => sessionStorage.getItem("pkl-admin-tab"));
  const p3 = await ctx.newPage();
  await p3.evaluateOnNewDocument((id) => { try { sessionStorage.setItem("pkl-admin-tab", id); } catch {} }, tabId);
  await p3.goto(SITE + "/admin", { waitUntil: "load" });
  await wait(500);
  t.rec("Browser: a duplicated tab (copied tab id) is detected and locked", (await p3.$eval("main h1", (e) => e.textContent).catch(() => "")) === "Admin locked in this tab");
  await p1.reload({ waitUntil: "load" });
  t.rec("Browser: the original tab still works after the others were locked", (await h1()) === "Research & Selected Work");

  // sign out clears every admin cookie
  const out = await fetch(SITE + "/auth/signout", { method: "POST", redirect: "manual", headers: { cookie: admin.cookieHeader, Origin: SITE } });
  const sc = out.headers.get("set-cookie") ?? "";
  t.rec("Sign out ends the session and clears the admin cookies", out.status === 303 && ["pkl_admin_act", "pkl_admin_grant", "pkl_admin_tab"].every((n) => sc.includes(`${n}=`)));
} catch (e) {
  t.rec("Session test run", false, e.message);
} finally {
  await b.close();
  await cleanup(c);
  await c.end();
}
t.done();
