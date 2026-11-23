/*
 * Browser side of the admin tab binding (server side: src/lib/admin/session-policy.ts).
 * - The tab id lives in sessionStorage: kept across refreshes of this tab, not shared with
 *   new tabs or windows.
 * - Every same-origin fetch from this tab — Next.js RSC navigations, prefetches and server
 *   actions all use window.fetch — carries it in the x-admin-tab header, which the server
 *   requires before returning any private data.
 */

const KEY = "pkl-admin-tab";
export const TAB_HEADER = "x-admin-tab";
/** Identifies this page load (to ignore our own answers in duplicate-tab detection). */
export const PAGE_ID = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Math.random());

export const readTab = () => { try { return sessionStorage.getItem(KEY); } catch { return null; } };
export const writeTab = (v: string | null) => {
  try { if (v) sessionStorage.setItem(KEY, v); else sessionStorage.removeItem(KEY); } catch { /* storage blocked: tab stays locked */ }
};

export function installTabFetch() {
  if (typeof window === "undefined") return;
  const w = window as Window & { __pklTabFetch?: boolean };
  if (w.__pklTabFetch) return;
  w.__pklTabFetch = true;
  const native = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const tab = readTab();
    if (!tab) return native(input, init);
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let same = false;
    try { same = new URL(raw, location.href).origin === location.origin; } catch { /* not a URL */ }
    if (!same) return native(input, init); // e.g. direct uploads to Supabase storage: never sent there
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    headers.set(TAB_HEADER, tab);
    return native(input, { ...init, headers });
  };
}

/** Answers "who owns tab id X?" for tabs opened later (a duplicated tab copies sessionStorage). */
export function answerOwnership() {
  let ch: BroadcastChannel | null = null;
  try { ch = new BroadcastChannel("pkl-admin"); } catch { return () => {}; }
  ch.onmessage = (e) => {
    const id = readTab();
    if (e.data?.type === "who" && e.data.from !== PAGE_ID && id && e.data.tabId === id) ch?.postMessage({ type: "owner", tabId: id, from: PAGE_ID });
  };
  return () => ch?.close();
}

export function ownedElsewhere(tabId: string): Promise<boolean> {
  let ch: BroadcastChannel | null = null;
  try { ch = new BroadcastChannel("pkl-admin"); } catch { return Promise.resolve(false); }
  const c = ch;
  return new Promise((resolve) => {
    const done = (v: boolean) => { clearTimeout(t); c.close(); resolve(v); };
    const t = setTimeout(() => done(false), 250);
    c.onmessage = (e) => { if (e.data?.type === "owner" && e.data.tabId === tabId && e.data.from !== PAGE_ID) done(true); };
    c.postMessage({ type: "who", tabId, from: PAGE_ID });
  });
}

export type SessionReply = { expired: true } | { ok: boolean; tabId?: string; idleLeft?: number };

export async function sessionCall(body: object, passive: boolean): Promise<SessionReply> {
  const r = await fetch("/admin/session", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(passive ? { "x-admin-passive": "1" } : {}) },
    body: JSON.stringify(body),
    cache: "no-store",
    credentials: "same-origin",
  });
  if (r.status === 401) return { expired: true };
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

export const expireSession = async () => {
  try { await fetch("/auth/signout", { method: "POST", credentials: "same-origin" }); } catch { /* server limit applies anyway */ }
  window.location.replace("/admin/login?error=expired");
};

/** Only same-site admin paths may be continued to after unlocking. */
export const safeNext = (v: string | null) => (v && /^\/admin(\/|\?|$)/.test(v) && !v.startsWith("//") && !v.startsWith("/admin/unlock") ? v : "/admin");
