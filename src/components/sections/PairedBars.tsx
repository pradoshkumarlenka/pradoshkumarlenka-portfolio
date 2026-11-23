"use client";

import { useRef, useState } from "react";
import type { ResearchFinding } from "@/content/types";
import { fill } from "@/lib/content/selectors";
import { useUi } from "@/lib/content/client";
import { EASE_PREMIUM, gsap, ScrollTrigger, useGSAP } from "@/lib/gsap";

type Labels = ReturnType<typeof useUi>["charts"]["pairedBars"];

const fmt = (unit: ResearchFinding["unit"], v: number) =>
  unit === "lakh-crore" ? `₹${v.toFixed(2)} lakh cr` : `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
const num = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

function change(f: ResearchFinding) {
  const d = f.after.value - f.before.value;
  const sign = d > 0 ? "+" : "−";
  if (f.unit === "percent") return `${sign}${Math.abs(d).toFixed(Number.isInteger(d) ? 0 : 1)} pp`;
  return `${sign}₹${Math.abs(d).toFixed(2)} lakh cr (${sign}${Math.abs((d / f.before.value) * 100).toFixed(0)}%)`;
}

/** Details for one bar — only the documented values and simple arithmetic on them. */
function details(f: ResearchFinding, i: number, labels: Labels): string[] {
  const row = i === 0 ? f.before : f.after;
  const out: string[] = [];
  if (i === 1) out.push(fill(labels.versus, { change: change(f), other: f.before.label }));
  else if (f.unit === "lakh-crore") out.push(fill(labels.shareOf, { share: Math.round((f.before.value / f.after.value) * 100), other: f.after.label }));
  if (f.unit === "percent" && row.value !== 100) {
    const gap = num(Math.abs(row.value - 100));
    out.push(fill(row.value > 100 ? labels.aboveFull : labels.belowFull, { gap }));
  }
  return out;
}

/**
 * Two documented values on a shared zero-based scale — a before/after
 * comparison, deliberately not a line (no intermediate points are implied).
 * Bars grow once when visible and end at the exact source values.
 * Hover, focus or tap a bar: it is highlighted, the gap between the two values
 * is marked, and the readout below gives the exact figures.
 */
export function PairedBars({ finding }: { finding: ResearchFinding }) {
  const labels = useUi().charts.pairedBars;
  const root = useRef<HTMLElement>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const active = hover ?? pinned;
  const rows = [
    { ...finding.before, tone: "bg-lavender/35" },
    { ...finding.after, tone: "bg-violet" },
  ];
  const pct = (v: number) => (v / finding.scaleMax) * 100;
  const lo = Math.min(finding.before.value, finding.after.value);
  const hi = Math.max(finding.before.value, finding.after.value);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const bars = gsap.utils.toArray<HTMLElement>("[data-bar]", root.current);
        gsap.set(bars, { scaleX: 0 });
        ScrollTrigger.create({
          trigger: root.current,
          start: "top 88%",
          once: true,
          onEnter: () => gsap.to(bars, { scaleX: 1, duration: 0.9, ease: EASE_PREMIUM, stagger: 0.1 }),
        });
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  const description = `${finding.label}: ${finding.before.label} ${fmt(finding.unit, finding.before.value)}, ${finding.after.label} ${fmt(finding.unit, finding.after.value)}.`;

  return (
    <figure ref={root} className="rounded-card border border-line bg-canvas/40 p-4 sm:p-5">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-fg">{finding.label}</span>
        <span className="tabular shrink-0 font-mono text-[11px] text-fg-muted">{change(finding)}</span>
      </figcaption>
      <p className="sr-only">{description}</p>
      <div className="relative mt-4 space-y-1">
        {finding.unit === "percent" && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-0.5 -top-0.5 border-l border-dashed border-fg-subtle/60"
            // label 4.25rem + gap 0.75rem + row padding 0.25rem | value 5.75rem + gap + padding
            style={{ left: `calc(5.25rem + (100% - 5.25rem - 6.75rem) * ${100 / finding.scaleMax})` }}
          />
        )}
        {rows.map((r, i) => {
          const dim = active !== null && active !== i;
          return (
            <button
              key={r.label}
              type="button"
              aria-pressed={pinned === i}
              aria-label={`${r.label}: ${fmt(finding.unit, r.value)}. ${details(finding, i, labels).join(". ")}`}
              onPointerEnter={(e) => e.pointerType === "mouse" && setHover(i)}
              onPointerLeave={(e) => e.pointerType === "mouse" && setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              onClick={() => setPinned((p) => (p === i ? null : i))}
              className={`flex w-full cursor-pointer items-center gap-3 rounded-[6px] px-1 py-1 text-left transition-[opacity,background-color] duration-200 motion-reduce:transition-none ${
                dim ? "opacity-45" : ""
              } ${active === i ? "bg-fg/[0.04]" : "hover:bg-fg/[0.03]"}`}
            >
              <span className="tabular w-[4.25rem] shrink-0 whitespace-nowrap font-mono text-[11px] text-fg-subtle">{r.label}</span>
              <span className="relative h-2.5 flex-1">
                <span
                  data-bar
                  className={`block h-full origin-left rounded-r-[4px] transition-[filter] duration-200 ${r.tone} ${active === i ? "brightness-125" : ""}`}
                  style={{ width: `${pct(r.value)}%` }}
                />
                {/* The gap between the two documented values, marked while a bar is active. */}
                {i === 1 && (
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute -inset-y-1 border-x border-lavender/80 bg-lavender/20 transition-opacity duration-200 motion-reduce:transition-none ${
                      active === null ? "opacity-0" : "opacity-100"
                    }`}
                    style={{ left: `${pct(lo)}%`, width: `${pct(hi) - pct(lo)}%` }}
                  />
                )}
              </span>
              <span className={`tabular w-[5.75rem] shrink-0 text-right text-sm transition-colors ${active === i ? "text-lavender" : "text-fg"}`}>
                {fmt(finding.unit, r.value)}
              </span>
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-2.5 min-h-[2.5em] text-[11px] leading-snug text-fg-subtle">
        {active === null ? (
          labels.hint
        ) : (
          <>
            <span className="text-fg">
              {rows[active].label} · {fmt(finding.unit, rows[active].value)}
            </span>
            {details(finding, active, labels).map((d) => (
              <span key={d}> · {d}</span>
            ))}
          </>
        )}
      </p>
      <p className="mt-1 text-[11px] text-fg-subtle">
        {finding.unit === "percent" && `${labels.referenceLine} `}
        {finding.source ? `${labels.sourcePrefix} ${finding.source}.` : labels.sourcePending}
      </p>
    </figure>
  );
}
