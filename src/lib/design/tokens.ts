import type { DesignFile } from "@/content/types";

/*
 * DESIGN TOKENS — the "design" content block mapped onto the CSS variables in
 * src/styles/theme.css. Only values that differ from the bundled defaults are
 * emitted, so with the default design the page HTML is unchanged.
 * Values are re-checked here (hex colours, bounded integers) before they are
 * written into CSS, so nothing else can ever reach the stylesheet.
 */

const COLOR_VARS: Record<keyof DesignFile["colors"], string> = {
  violet: "--color-violet",
  lavender: "--color-lavender",
  onViolet: "--color-on-violet",
  fg: "--color-fg",
  fgMuted: "--color-fg-muted",
  fgSubtle: "--color-fg-subtle",
  surface: "--color-surface",
  surface2: "--color-surface-2",
  positive: "--color-positive",
  negative: "--color-negative",
};
const RADIUS_VARS: Record<keyof DesignFile["radii"], [string, number]> = {
  control: ["--radius-control", 24],
  card: ["--radius-card", 40],
  panel: ["--radius-panel", 48],
};
const HEX = /^#[0-9a-fA-F]{6}$/;

/** CSS for the differences between `design` and `defaults` ("" when identical). */
export function designOverridesCss(design: DesignFile, defaults: DesignFile): string {
  const decls: string[] = [];
  for (const [k, cssVar] of Object.entries(COLOR_VARS) as [keyof DesignFile["colors"], string][]) {
    const v = design.colors?.[k];
    if (typeof v === "string" && HEX.test(v) && v.toLowerCase() !== defaults.colors[k].toLowerCase()) decls.push(`${cssVar}:${v.toLowerCase()}`);
  }
  for (const [k, [cssVar, max]] of Object.entries(RADIUS_VARS) as [keyof DesignFile["radii"], [string, number]][]) {
    const v = design.radii?.[k];
    if (typeof v === "number" && Number.isFinite(v) && v !== defaults.radii[k]) decls.push(`${cssVar}:${Math.round(Math.min(max, Math.max(0, v)))}px`);
  }
  return decls.length ? `:root{${decls.join(";")}}` : "";
}
