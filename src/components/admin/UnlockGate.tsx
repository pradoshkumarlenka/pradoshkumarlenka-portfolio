"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { expireSession, installTabFetch, ownedElsewhere, readTab, safeNext, sessionCall, writeTab, type SessionReply } from "./tab-session";
import { card, primaryBtn, secondaryBtn } from "./styles";

installTabFetch();

// One claim per page load (React may run effects twice in development; the grant is one-time).
let claiming: Promise<SessionReply> | null = null;

/**
 * /admin/unlock — every full page load of the admin lands here first (the server sends no
 * private data to a load that cannot prove its tab). This tab either already holds the
 * session (refresh), or has just signed in (one-time grant), or is another tab → locked.
 */
export function UnlockGate({ next }: { next: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<"checking" | "locked" | "error">("checking");

  useEffect(() => {
    let stopped = false;
    (async () => {
      try {
        let id = readTab();
        if (id && (await ownedElsewhere(id))) { id = null; writeTab(null); } // duplicated tab
        let res: SessionReply;
        if (id) res = await sessionCall({ op: "check", tabId: id }, true);
        else {
          claiming ??= sessionCall({ op: "claim" }, true).then((r) => { if (!("expired" in r) && r.ok && r.tabId) writeTab(r.tabId); return r; });
          res = await claiming;
        }
        if (stopped) return;
        if ("expired" in res) return void expireSession();
        if (!res.ok) { writeTab(null); return setState("locked"); }
        router.replace(safeNext(next)); // client navigation: carries the tab proof
      } catch {
        if (!stopped) setState("error");
      }
    })();
    return () => { stopped = true; };
  }, [next, router]);

  if (state === "checking") return <p role="status" data-session-checking className="text-sm text-fg-muted">Checking your session…</p>;
  return (
    <section className={`${card} mx-auto max-w-lg p-6`} aria-labelledby="h-locked">
      <h1 id="h-locked" className="font-display text-3xl">{state === "locked" ? "Admin locked in this tab" : "Session check failed"}</h1>
      <p className="mt-3 text-sm text-fg-muted">
        {state === "locked"
          ? "For security, the admin area works only in the browser tab where you signed in. Go back to that tab, or sign in again here — access then moves to this tab and the other tab is locked."
          : "Your session could not be confirmed (connection problem?). Reload to try again."}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {state === "locked" ? (
          <a href="/admin/login?retab=1" className={primaryBtn}>Sign in again in this tab</a>
        ) : (
          <button type="button" className={primaryBtn} onClick={() => window.location.reload()}>Reload</button>
        )}
        <form action="/auth/signout" method="post"><button type="submit" className={secondaryBtn}>Sign out everywhere</button></form>
      </div>
    </section>
  );
}
