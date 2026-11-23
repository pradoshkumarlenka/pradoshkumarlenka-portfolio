import type { ItemState } from "@/lib/admin/types";

const STYLE: Record<ItemState, string> = {
  published: "border-positive/50 text-positive",
  draft: "border-line-strong text-fg-muted",
  archived: "border-line text-fg-subtle",
};
const TEXT: Record<ItemState, string> = { published: "Published", draft: "Draft", archived: "Archived" };

/** Publication state chip (text, not colour alone). */
export function StateBadge({ state }: { state: ItemState }) {
  return <span className={`rounded-chip border px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${STYLE[state]}`}>{TEXT[state]}</span>;
}
