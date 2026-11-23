import type { LeadershipItem } from "@/content/types";
import { Reveal } from "@/components/motion/Reveal";

const SPAN: Record<LeadershipItem["size"], string> = {
  large: "md:col-span-2 lg:col-span-2 lg:row-span-2",
  medium: "md:col-span-2 lg:col-span-2",
  small: "md:col-span-1 lg:col-span-1",
};

/**
 * LEADERSHIP — bento grid (content/leadership.json). Card size comes from each
 * item's "size". The impact sentence is always visible (touch / keyboard);
 * hover or focus only brightens it.
 */
export function Leadership({ items }: { items: LeadershipItem[] }) {
  return (
    <Reveal distance={16} blur={0} duration={0.6} stagger={0.08} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <article
          key={item.role}
          className={`group relative flex flex-col rounded-card border border-line bg-surface/55 p-6 shadow-card backdrop-blur-[3px] transition-[translate,border-color,background-color] duration-300 ease-premium hover:-translate-y-0.5 hover:border-violet/55 hover:bg-surface/75 motion-reduce:hover:translate-y-0 sm:p-7 ${SPAN[item.size]}`}
        >
          {item.size === "large" ? <LargeCard item={item} /> : <Card item={item} />}
        </article>
      ))}
    </Reveal>
  );
}

function Header({ item, large = false }: { item: LeadershipItem; large?: boolean }) {
  return (
    <header>
      <h3 className={`font-display leading-tight text-fg ${large ? "text-[2.1rem] sm:text-[2.5rem]" : "text-[1.35rem]"}`}>{item.role}</h3>
      <p className="mt-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-lavender">{item.context}</p>
    </header>
  );
}

function Impact({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="mt-4 flex gap-3 text-sm leading-relaxed text-fg-muted transition-colors duration-300 group-hover:text-fg">
      <span aria-hidden="true" className="mt-[0.7rem] h-px w-4 shrink-0 bg-violet/70 transition-[width] duration-300 ease-premium group-hover:w-6" />
      {text}
    </p>
  );
}

function LargeCard({ item }: { item: LeadershipItem }) {
  return (
    <>
      <Header item={item} large />
      {item.stats && (
        <dl className="mt-8 grid grid-cols-3 gap-4 border-y border-line py-6">
          {item.stats.map((s) => (
            <div key={s.label}>
              <dt className="sr-only">{s.label}</dt>
              <dd className="tabular font-display text-[1.9rem] leading-none text-fg sm:text-[2.4rem]">{s.value}</dd>
              <dd className="mt-2 text-xs leading-snug text-fg-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
      )}
      <p className="mt-6 max-w-xl leading-relaxed text-fg-muted">{item.detail}</p>
      <div className="mt-auto pt-2">
        <Impact text={item.impact} />
      </div>
    </>
  );
}

function Card({ item }: { item: LeadershipItem }) {
  return (
    <>
      {item.metric && (
        <p className="mb-5 flex items-baseline gap-2">
          <span className="tabular font-display text-[2.4rem] leading-none text-fg">{item.metric}</span>
          {item.metricLabel && <span className="text-xs text-fg-muted">{item.metricLabel}</span>}
        </p>
      )}
      <Header item={item} />
      <p className="mt-3 text-sm leading-relaxed text-fg-muted">{item.detail}</p>
      <Impact text={item.impact} />
    </>
  );
}
