import { isDraftPreview } from "@/lib/content/draft-source";
import { PreviewTabFetch } from "./PreviewTabFetch";

/**
 * Shown only to the administrator while Draft Mode preview is on.
 * Renders nothing for visitors (no markup, no layout change).
 */
export async function PreviewBanner() {
  if (!(await isDraftPreview())) return null;
  return (
    <div role="status" className="fixed inset-x-0 bottom-0 z-[100] flex items-center justify-center gap-3 bg-violet/95 px-4 py-2 text-sm text-white shadow-lg">
      <PreviewTabFetch />
      <span>Preview — showing unpublished drafts (only you can see this)</span>
      <form action="/admin/preview/exit" method="post">
        <input type="hidden" name="back" value="site" />
        <button type="submit" className="rounded-chip border border-white/60 px-3 py-0.5 text-xs hover:bg-white/15">Exit preview</button>
      </form>
    </div>
  );
}
