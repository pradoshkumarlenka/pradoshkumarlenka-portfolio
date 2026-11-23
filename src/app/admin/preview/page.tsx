import { cookies, draftMode } from "next/headers";
import { requireAdminPage } from "@/lib/admin/auth";
import { safePreviewPath } from "@/lib/admin/preview";
import { createClient } from "@/lib/supabase/server";
import { CONTENT_TITLES } from "@/lib/admin/content-data";
import type { ContentKey } from "@/lib/content/registry";
import { PreviewFrame } from "@/components/admin/content/PreviewFrame";
import { card, primaryBtn, secondaryBtn } from "@/components/admin/styles";
import { StartPreviewButton } from "@/components/admin/AdminRequests";
import { TAB_COOKIE, previewTicket } from "@/lib/admin/session-policy";

export const dynamic = "force-dynamic";

/** Shows the real site with unpublished drafts applied, at phone / tablet / desktop widths. */
export default async function PreviewPage({ searchParams }: { searchParams: Promise<{ path?: string }> }) {
  const session = await requireAdminPage();
  const { path: raw } = await searchParams;
  const path = safePreviewPath(raw);
  const { isEnabled } = await draftMode();
  const supabase = await createClient();
  const { data } = await supabase.from("content_drafts").select("key").order("key");
  const drafts = (data ?? []).map((r) => CONTENT_TITLES[r.key as ContentKey] ?? r.key);
  // The iframe's page load cannot carry the tab proof: give it a 30-minute ticket bound to this tab.
  const ticket = isEnabled ? await previewTicket((await cookies()).get(TAB_COOKIE)?.value, session.userId) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Preview</h1>
          <p className="mt-2 text-sm text-fg-muted">
            {drafts.length ? <>Showing your unpublished drafts: {drafts.join(", ")}.</> : "There are no unpublished drafts — this is what visitors see."} Only you can see this.
          </p>
        </div>
        {isEnabled ? (
          <form action="/admin/preview/exit" method="post">
            <button type="submit" className={secondaryBtn}>Exit preview</button>
          </form>
        ) : (
          <StartPreviewButton path={path} label="Start preview" className={primaryBtn} />
        )}
      </div>
      {isEnabled ? (
        <PreviewFrame path={path} ticket={ticket} />
      ) : (
        <p className={`${card} p-6 text-sm text-fg-muted`}>Preview is off. Start it to see your drafts inside the real site.</p>
      )}
    </div>
  );
}
