"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { answerOwnership, expireSession, installTabFetch, readTab, sessionCall, type SessionReply } from "./tab-session";
import { secondaryBtn } from "./styles";

/*
 * ADMIN SESSION KEEPER (all admin pages except login and unlock).
 * The server already refuses private data to any request that does not prove it comes from
 * the session's tab (see src/lib/admin/auth.ts); this component:
 *  - adds that proof to every same-origin fetch of this tab (installed before hydration);
 *  - answers duplicate-tab questions from newly opened tabs;
 *  - reports activity at most once a minute (checks without activity are "passive" and do
 *    not extend the session) and warns 2 minutes before the idle limit;
 *  - moves to the unlock page if access was moved to another tab.
 */

installTabFetch();

const CHECK_MS = 60_000;
const WARN_MS = 2 * 60_000;

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const exempt = pathname === "/admin/login" || pathname === "/admin/unlock";
  const [left, setLeft] = useState<number | null>(null);
  const active = useRef(false);
  const deadline = useRef(0);

  const apply = useCallback((res: SessionReply) => {
    if ("expired" in res) return void expireSession();
    if (!res.ok) {
      window.location.replace(`/admin/unlock?next=${encodeURIComponent(location.pathname + location.search)}`);
      return;
    }
    if (typeof res.idleLeft === "number") deadline.current = Date.now() + res.idleLeft;
  }, []);

  useEffect(() => {
    if (exempt) return;
    const stopAnswering = answerOwnership();
    const check = async (passive: boolean) => {
      const id = readTab();
      if (!id) return apply({ ok: false });
      try { apply(await sessionCall({ op: "check", tabId: id }, passive)); } catch { /* offline: retry next tick */ }
    };
    void check(true);
    const mark = () => { active.current = true; };
    const evs = ["pointerdown", "keydown", "wheel", "touchstart", "input"] as const;
    evs.forEach((e) => window.addEventListener(e, mark, { passive: true }));
    const timer = setInterval(() => { const a = active.current; active.current = false; void check(!a); }, CHECK_MS);
    const tick = setInterval(() => {
      if (!deadline.current) return;
      const l = deadline.current - Date.now();
      if (l <= 0) void expireSession();
      setLeft(l <= WARN_MS ? Math.max(0, l) : null);
    }, 1000);
    const onVisible = () => { if (document.visibilityState === "visible") void check(true); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopAnswering();
      clearInterval(timer);
      clearInterval(tick);
      evs.forEach((e) => window.removeEventListener(e, mark));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [exempt, apply]);

  const stay = async () => {
    const id = readTab();
    if (id) try { apply(await sessionCall({ op: "check", tabId: id }, false)); } catch { /* retry on next tick */ }
  };

  return (
    <>
      {left !== null && !exempt && (
        <div role="alert" className="mb-6 flex flex-wrap items-center gap-3 rounded-control border border-lavender/40 bg-surface px-4 py-3 text-sm">
          <span>For security you will be signed out in {Math.ceil(left / 1000)} s because of inactivity. Unsaved changes would be lost.</span>
          <button type="button" className={secondaryBtn} onClick={stay}>Stay signed in</button>
        </div>
      )}
      {children}
    </>
  );
}
