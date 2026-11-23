"use client";

import { useState } from "react";

const DEVICES = [
  { id: "phone", label: "Phone", width: 375, height: 760 },
  { id: "tablet", label: "Tablet", width: 768, height: 900 },
  { id: "desktop", label: "Desktop", width: 1440, height: 900 },
] as const;

/**
 * The site in an iframe at a chosen device width. Drafts are shown only with the Draft Mode
 * cookie AND this tab's proof: the first load carries a short ticket (?_pv=), later in-frame
 * navigations carry the tab header (PreviewBanner installs it). Admin-only, this tab only.
 */
export function PreviewFrame({ path, ticket }: { path: string; ticket: string | null }) {
  const [device, setDevice] = useState<(typeof DEVICES)[number]>(DEVICES[2]);
  const [nonce, setNonce] = useState(0);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label="Device width" className="inline-flex rounded-chip border border-line p-0.5 text-sm">
          {DEVICES.map((d) => (
            <button key={d.id} type="button" role="radio" aria-checked={device.id === d.id} onClick={() => setDevice(d)}
              className={`rounded-chip px-4 py-1.5 ${device.id === d.id ? "bg-violet text-on-violet" : "text-fg-muted hover:text-fg"}`}>
              {d.label} <span className="font-mono text-[10px] opacity-70">{d.width}</span>
            </button>
          ))}
        </div>
        <button type="button" onClick={() => setNonce((n) => n + 1)} className="text-sm text-fg-muted hover:text-fg">↻ Reload</button>
      </div>
      <div className="overflow-x-auto rounded-card border border-line bg-black/40 p-3">
        <iframe
          key={`${device.id}-${nonce}`}
          title={`Draft preview of ${path} at ${device.label.toLowerCase()} width`}
          src={ticket ? `${path}${path.includes("?") ? "&" : "?"}_pv=${encodeURIComponent(ticket)}` : path}
          style={{ width: device.width, height: device.height }}
          className="mx-auto block max-w-none rounded-control bg-canvas"
        />
      </div>
    </div>
  );
}
