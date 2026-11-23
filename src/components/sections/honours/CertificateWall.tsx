"use client";

import Image from "next/image";
import { useState } from "react";
import type { Certification, CertificationCategory, HonoursFile } from "@/content/types";
import { ViewerModal, ViewerStatus } from "@/components/viewers/ViewerModal";
import { useAnimationConfig, useUi } from "@/lib/content/client";

type Labels = HonoursFile["labels"];
type Filter = "all" | CertificationCategory;
const FILTERS: { key: Filter; label: keyof Labels["filters"] }[] = [
  { key: "all", label: "all" },
  { key: "Finance", label: "finance" },
  { key: "Analytics", label: "analytics" },
  { key: "Professional", label: "professional" },
  { key: "Campus", label: "campus" },
];

/** One certificate with its server-checked file paths (null = file not available). */
export type WallItem = Certification & { imageSrc: string | null; downloadSrc: string | null };

/**
 * CERTIFICATE WALL — real rendered certificates (content/honours.json →
 * certifications; images made by `npm run certificates`). Filters fade the
 * grid briefly; clicking a card opens the full certificate in the lightbox.
 */
export function CertificateWall({ items, labels }: { items: WallItem[]; labels: Labels }) {
  const FADE_MS = useAnimationConfig().certificateWall.filterFadeMs;
  const [filter, setFilter] = useState<Filter>("all");
  const [fading, setFading] = useState(false);
  const [open, setOpen] = useState<{ item: WallItem; from: HTMLElement } | null>(null);

  const choose = (next: Filter) => {
    if (next === filter) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return setFilter(next);
    setFading(true);
    window.setTimeout(() => {
      setFilter(next);
      setFading(false);
    }, FADE_MS);
  };
  const shown = items.filter((c) => filter === "all" || c.category === filter);

  return (
    <div>
      <div role="group" aria-label="Filter certificates" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => choose(f.key)}
            className={`rounded-chip border px-3.5 py-1.5 text-xs transition-colors duration-200 ${
              filter === f.key ? "border-violet/70 bg-violet/15 text-fg" : "border-line text-fg-muted hover:border-line-strong hover:text-fg"
            }`}
          >
            {labels.filters[f.label]}
          </button>
        ))}
      </div>

      <div className={`transition-opacity duration-150 ease-premium ${fading ? "opacity-0" : "opacity-100"}`} aria-live="polite">
        {shown.length === 0 ? (
          <p className="rounded-card border border-dashed border-line-strong px-6 py-10 text-center text-sm text-fg-muted">{labels.emptyFilter}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c) => (
              <li key={c.name}>
                <CertificateCard item={c} labels={labels} onOpen={(from) => setOpen({ item: c, from })} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && <CertificateLightbox item={open.item} labels={labels} returnFocus={open.from} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CertificateCard({ item, labels, onOpen }: { item: WallItem; labels: Labels; onOpen: (from: HTMLElement) => void }) {
  const meta = (
    <div className="flex flex-1 flex-col gap-2 p-5">
      <span className="w-fit rounded-chip border border-line px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-muted">
        {item.category}
      </span>
      <h3 className="text-[15px] font-medium leading-snug text-fg">{item.name}</h3>
      <p className="text-sm text-fg-muted">
        {item.issuer} · <span className="tabular">{item.date ?? item.year}</span>
      </p>
    </div>
  );
  const frame = "relative aspect-[4/3] overflow-hidden border-b border-line bg-[#e9e8f0]";

  if (!item.imageSrc) {
    return (
      <article className="flex h-full flex-col overflow-hidden rounded-card border border-dashed border-line-strong bg-surface/40">
        <div className={`${frame} flex items-center justify-center bg-canvas-2`}>
          <p className="px-6 text-center font-mono text-[11px] uppercase tracking-[0.14em] text-fg-subtle">
            {item.filePrivate ? labels.certificatePrivate : labels.certificatePending}
          </p>
        </div>
        {meta}
      </article>
    );
  }
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={`${labels.openCertificate}: ${item.name}`}
      onClick={(e) => onOpen(e.currentTarget)}
      className="group flex h-full w-full flex-col overflow-hidden rounded-card border border-line bg-surface/55 text-left shadow-card transition-[translate,border-color] duration-300 ease-premium hover:-translate-y-0.5 hover:border-violet/55 focus-visible:border-violet/55"
    >
      <div className={frame}>
        <Image
          src={item.imageSrc}
          alt=""
          fill
          sizes="(min-width: 1024px) 380px, (min-width: 640px) 45vw, 90vw"
          className="object-contain p-3 opacity-85 saturate-[0.85] transition-[opacity,filter] duration-300 group-hover:opacity-100 group-hover:saturate-100"
        />
        <span className="absolute bottom-3 right-3 rounded-chip bg-canvas/85 px-2.5 py-1 text-[11px] text-fg opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          {labels.openCertificate} ↗
        </span>
      </div>
      {meta}
    </button>
  );
}

function CertificateLightbox({
  item,
  labels,
  returnFocus,
  onClose,
}: {
  item: WallItem;
  labels: Labels;
  returnFocus: HTMLElement;
  onClose: () => void;
}) {
  const ui = useUi();
  const [actual, setActual] = useState(false);
  const [failed, setFailed] = useState(false);
  const chip = "rounded-chip border border-line-strong px-3 py-1.5 text-xs text-fg transition-colors hover:border-lavender";
  const toolbar = (
    <div className="flex items-center gap-2">
      {item.verifyUrl && (
        <a href={item.verifyUrl} target="_blank" rel="noopener noreferrer" className={chip}>
          {labels.verify} <span aria-hidden="true">↗</span>
          <span className="sr-only"> {ui.resources.opensInNewTab}</span>
        </a>
      )}
      {!failed && (
        <button type="button" className={chip} aria-pressed={actual} onClick={() => setActual((a) => !a)}>
          {actual ? labels.fit : labels.actualSize}
        </button>
      )}
    </div>
  );
  return (
    <ViewerModal
      title={item.name}
      filename={`${item.issuer} · ${item.date ?? item.year}`}
      downloadHref={item.downloadSrc ?? undefined}
      downloadLabel={labels.download}
      onClose={onClose}
      returnFocus={returnFocus}
      toolbar={toolbar}
    >
      {failed ? (
        <ViewerStatus kind="error">{labels.imageError}</ViewerStatus>
      ) : (
        <div className={`h-full overflow-auto bg-canvas p-3 sm:p-6 ${actual ? "" : "flex items-center justify-center"}`} tabIndex={0}>
          {/* eslint-disable-next-line @next/next/no-img-element -- full-resolution original rendering, sized to the viewport */}
          <img
            src={item.imageSrc ?? ""}
            alt={`${item.name} — ${item.issuer}`}
            onError={() => setFailed(true)}
            className={actual ? "max-w-none" : "max-h-full max-w-full object-contain shadow-raised"}
          />
        </div>
      )}
    </ViewerModal>
  );
}
