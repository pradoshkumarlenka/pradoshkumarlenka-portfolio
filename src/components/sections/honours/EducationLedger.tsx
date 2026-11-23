import type { EducationItem, HonoursFile } from "@/content/types";

type Headings = HonoursFile["labels"]["tableHeadings"];

function Badges({ badges }: { badges?: string[] }) {
  if (!badges?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {badges.map((b) => (
        <span key={b} className="rounded-chip border border-violet/40 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-lavender">
          {b}
        </span>
      ))}
    </div>
  );
}

/** EDUCATION — ledger table on wide screens, stacked entries on phones. */
export function EducationLedger({ items, notes, headings }: { items: EducationItem[]; notes?: string[]; headings: Headings }) {
  return (
    <div>
      {/* Wide screens */}
      <div className="hidden overflow-hidden rounded-card border border-line bg-surface/55 md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
              <th scope="col" className="px-5 py-3.5 font-normal">{headings.qualification}</th>
              <th scope="col" className="px-5 py-3.5 font-normal">{headings.institute}</th>
              <th scope="col" className="px-5 py-3.5 font-normal">{headings.board}</th>
              <th scope="col" className="px-5 py-3.5 text-right font-normal">{headings.year}</th>
              <th scope="col" className="px-5 py-3.5 text-right font-normal">{headings.score}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((e) => (
              <tr key={e.qualification} className="border-b border-line/70 align-top last:border-0">
                <th scope="row" className="px-5 py-4 font-medium text-fg">
                  {e.qualification}
                  {e.detail && <p className="mt-1 max-w-[16rem] text-xs font-normal leading-snug text-fg-muted">{e.detail}</p>}
                  <Badges badges={e.badges} />
                </th>
                <td className="px-5 py-4 text-fg-muted">{e.institute}</td>
                <td className="px-5 py-4 text-fg-muted">{e.board}</td>
                <td className="tabular px-5 py-4 text-right text-fg-muted">{e.years}</td>
                <td className="tabular whitespace-nowrap px-5 py-4 text-right font-display text-xl text-fg">
                  {e.score}
                  {e.scoreNote && <sup className="ml-0.5 text-xs text-fg-muted">{e.scoreNote}</sup>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones */}
      <ul className="space-y-3 md:hidden">
        {items.map((e) => (
          <li key={e.qualification} className="rounded-card border border-line bg-surface/55 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-fg">{e.qualification}</p>
                {e.detail && <p className="mt-1 text-xs leading-snug text-fg-muted">{e.detail}</p>}
              </div>
              <p className="tabular shrink-0 font-display text-2xl leading-none text-fg">
                {e.score}
                {e.scoreNote && <sup className="ml-0.5 text-xs text-fg-muted">{e.scoreNote}</sup>}
              </p>
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              <div className="flex gap-2"><dt className="sr-only">{headings.institute}</dt><dd className="text-fg-muted">{e.institute}</dd></div>
              <div className="flex gap-2 text-fg-subtle">
                <dt className="sr-only">{headings.board}</dt><dd>{e.board}</dd>
                <span aria-hidden="true">·</span>
                <dt className="sr-only">{headings.year}</dt><dd className="tabular">{e.years}</dd>
              </div>
            </dl>
            <Badges badges={e.badges} />
          </li>
        ))}
      </ul>

      {notes?.map((n) => (
        <p key={n} className="mt-4 text-xs text-fg-muted">{n}</p>
      ))}
    </div>
  );
}
