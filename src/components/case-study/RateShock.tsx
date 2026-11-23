"use client";

import { useId, useState } from "react";
import { fill } from "@/lib/content/selectors";
import { useUi } from "@/lib/content/client";

/**
 * Rate-shock illustration from the project's documented modified duration and
 * convexity, using the standard second-order approximation for a parallel
 * yield shift:  ΔP/P ≈ −D·Δy + ½·C·Δy².  Not a price forecast.
 */
export function RateShock({ modifiedDuration, convexity, anchor }: { modifiedDuration: number; convexity: number; anchor: { bp: number; change: string } }) {
  const ui = useUi();
  const [bp, setBp] = useState(anchor.bp);
  const id = useId();
  const dy = bp / 10000;
  const pct = (-modifiedDuration * dy + 0.5 * convexity * dy * dy) * 100;
  const fmt = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;
  const scale = 20; // ±20% maps to the full bar
  const width = Math.min(Math.abs(pct) / scale, 1) * 50;
  const t = ui.charts.rateShock;

  return (
    <figure className="rounded-card border border-line bg-surface/55 p-5 backdrop-blur-[3px] sm:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <figcaption className="font-mono text-xs uppercase tracking-[0.18em] text-lavender">{t.title}</figcaption>
        <span className="rounded-chip border border-line px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-fg-muted">
          {t.badge}
        </span>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <label htmlFor={id} className="flex items-baseline justify-between text-sm text-fg-muted">
            {t.shiftLabel}
            <span className="tabular font-mono text-fg">{bp > 0 ? `+${bp}` : bp} bp</span>
          </label>
          <input
            id={id}
            type="range"
            min={-100}
            max={200}
            step={5}
            value={bp}
            onChange={(e) => setBp(Number(e.target.value))}
            aria-valuetext={`${bp} basis points, estimated value change ${fmt(pct)}`}
            className="mt-3 w-full accent-[var(--color-violet)]"
          />
          <div className="tabular mt-1 flex justify-between font-mono text-[10px] text-fg-subtle">
            <span>−100 bp</span>
            <span>0</span>
            <span>+200 bp</span>
          </div>
        </div>
        <div className="text-right" aria-live="polite">
          <p className="text-xs text-fg-subtle">{t.changeLabel}</p>
          <p className={`tabular font-display text-5xl leading-none ${pct < 0 ? "text-negative" : pct > 0 ? "text-positive" : "text-fg"}`}>{fmt(pct)}</p>
        </div>
      </div>

      {/* Diverging bar: zero in the centre, losses left, gains right. */}
      <div aria-hidden="true" className="relative mt-6 h-2 rounded-full bg-line">
        <span className="absolute inset-y-[-4px] left-1/2 border-l border-fg-subtle/70" />
        <span
          className={`absolute inset-y-0 rounded-full transition-[width,left] duration-200 ease-premium ${pct < 0 ? "bg-negative/80" : "bg-positive/80"}`}
          style={pct < 0 ? { left: `${50 - width}%`, width: `${width}%` } : { left: "50%", width: `${width}%` }}
        />
      </div>

      <p className="mt-5 text-xs leading-relaxed text-fg-subtle">
        {fill(t.footnote, {
          D: modifiedDuration,
          C: convexity,
          bp: `${anchor.bp > 0 ? "+" : ""}${anchor.bp}`,
          result: fmt((-modifiedDuration * (anchor.bp / 1e4) + 0.5 * convexity * (anchor.bp / 1e4) ** 2) * 100),
          documented: anchor.change,
        })}
      </p>
    </figure>
  );
}
