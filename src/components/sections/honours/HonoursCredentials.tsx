"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { EducationItem, Honour, HonoursFile } from "@/content/types";
import { PrismCarousel } from "./PrismCarousel";
import { CertificateWall, type WallItem } from "./CertificateWall";
import { EducationLedger } from "./EducationLedger";

type TabKey = "honours" | "certifications" | "education";
const TABS: TabKey[] = ["honours", "certifications", "education"];

interface Props {
  honours: Honour[];
  archive: Honour[];
  certificates: WallItem[];
  education: EducationItem[];
  educationNotes?: string[];
  labels: HonoursFile["labels"];
}

/**
 * HONOURS & CREDENTIALS — three ARIA tabs (←/→/Home/End move between tabs).
 * Panels stay mounted (state is kept); only the honours carousel is paused
 * while its tab is hidden.
 */
export function HonoursCredentials({ honours, archive, certificates, education, educationNotes, labels }: Props) {
  const [tab, setTab] = useState<TabKey>("honours");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const buttons = useRef<Record<TabKey, HTMLButtonElement | null>>({ honours: null, certifications: null, education: null });
  const indicator = useRef<HTMLSpanElement>(null);

  // Slide the active-tab indicator under the selected tab.
  useLayoutEffect(() => {
    const place = () => {
      const b = buttons.current[tab];
      const bar = indicator.current;
      if (!b || !bar) return;
      bar.style.width = `${b.offsetWidth}px`;
      bar.style.transform = `translateX(${b.offsetLeft}px)`;
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [tab]);

  const onKey = (e: React.KeyboardEvent) => {
    const i = TABS.indexOf(tab);
    const next =
      e.key === "ArrowRight" ? TABS[(i + 1) % TABS.length] :
      e.key === "ArrowLeft" ? TABS[(i - 1 + TABS.length) % TABS.length] :
      e.key === "Home" ? TABS[0] :
      e.key === "End" ? TABS[TABS.length - 1] : null;
    if (!next) return;
    e.preventDefault();
    setTab(next);
    buttons.current[next]?.focus();
  };

  return (
    <div>
      <div className="relative mb-10 overflow-x-auto [scrollbar-width:none]">
        <div role="tablist" aria-label={labels.tabs.honours} onKeyDown={onKey} className="relative flex w-max gap-1 border-b border-line">
          {TABS.map((key) => (
            <button
              key={key}
              ref={(el) => void (buttons.current[key] = el)}
              role="tab"
              id={`tab-${key}`}
              aria-selected={tab === key}
              aria-controls={`panel-${key}`}
              tabIndex={tab === key ? 0 : -1}
              onClick={() => setTab(key)}
              className={`px-4 pb-3 pt-1 text-sm transition-colors duration-200 sm:text-base ${tab === key ? "text-fg" : "text-fg-muted hover:text-fg"}`}
            >
              {labels.tabs[key]}
            </button>
          ))}
          <span
            ref={indicator}
            aria-hidden="true"
            className="absolute -bottom-px left-0 h-0.5 rounded-full bg-violet transition-[transform,width] duration-300 ease-premium"
          />
        </div>
      </div>

      <div role="tabpanel" id="panel-honours" aria-labelledby="tab-honours" hidden={tab !== "honours"}>
        <PrismCarousel items={honours} labels={labels} active={tab === "honours"} />
        {archive.length > 0 && (
          <div className="mt-10 border-t border-line pt-6">
            <button
              type="button"
              aria-expanded={archiveOpen}
              aria-controls="honours-archive"
              onClick={() => setArchiveOpen((o) => !o)}
              className="tap-target inline-flex items-center gap-2 text-sm text-fg underline decoration-line-strong underline-offset-[6px] transition-colors hover:decoration-lavender"
            >
              {archiveOpen ? labels.archiveHide : labels.archiveShow}
              <span aria-hidden="true" className={`inline-block transition-transform duration-300 ease-premium ${archiveOpen ? "rotate-180" : ""}`}>
                ↓
              </span>
            </button>
            <div
              id="honours-archive"
              className={`grid transition-[grid-template-rows] duration-300 ease-premium ${archiveOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
              inert={!archiveOpen}
            >
              <ul className="grid gap-3 overflow-hidden sm:grid-cols-3">
                {archive.map((h) => (
                  <li key={h.title} className="mt-5 rounded-card border border-line bg-surface/40 p-4">
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">{h.category}</p>
                    <p className="mt-2 text-sm text-fg">{h.title}</p>
                    {h.detail && <p className="mt-1 text-xs text-fg-muted">{h.detail}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div role="tabpanel" id="panel-certifications" aria-labelledby="tab-certifications" hidden={tab !== "certifications"}>
        <CertificateWall items={certificates} labels={labels} />
      </div>

      <div role="tabpanel" id="panel-education" aria-labelledby="tab-education" hidden={tab !== "education"}>
        <EducationLedger items={education} notes={educationNotes} headings={labels.tableHeadings} />
      </div>
    </div>
  );
}
