import type { Metadata } from "next";
import Link from "next/link";
import { getAdminSession } from "@/lib/admin/auth";
import { secondaryBtn } from "@/components/admin/styles";
import { SessionGuard } from "@/components/admin/SessionGuard";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false, nocache: true },
};

/** Private admin area: plain layout (no 3D background), never indexed or cached. */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getAdminSession();
  // "locked" = signed in, but this request has not (yet) proven its tab, e.g. the unlock page.
  // The navigation itself is not private; the pages behind it check the tab again.
  const signedIn = session.status === "admin" || session.status === "locked";
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <header className="border-b border-line bg-surface/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/admin" prefetch={false} className="font-display text-lg">
            PKL <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-lavender">Admin</span>
          </Link>
          <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1 text-sm">
            {signedIn && (
              <nav aria-label="Admin" className="flex items-center gap-3">
                <Link href="/admin" prefetch={false} className="tap-target text-fg-muted hover:text-fg">Work items</Link>
                <Link href="/admin/content" prefetch={false} className="tap-target text-fg-muted hover:text-fg">Site content</Link>
                <Link href="/admin/media" prefetch={false} className="tap-target text-fg-muted hover:text-fg">Media</Link>
              </nav>
            )}
            <Link href="/" prefetch={false} className="tap-target text-fg-muted hover:text-fg">View site ↗</Link>
            {session.status !== "signed-out" && session.status !== "unconfigured" && (
              <form action="/auth/signout" method="post">
                <button type="submit" className={secondaryBtn}>Sign out</button>
              </form>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-5 py-10">{signedIn ? <SessionGuard>{children}</SessionGuard> : children}</main>
    </div>
  );
}
