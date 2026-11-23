"use client";

import { Button } from "@/components/ui/Button";
import { Magnetic } from "@/components/ui/Magnetic";
import { scrollToTarget } from "@/lib/lenis";

interface HeroActionsProps {
  primaryLabel: string;
  secondaryLabel: string;
  /** Résumé path if the PDF exists, otherwise null (button shown disabled). */
  resumeHref: string | null;
  resumeDownloadName: string;
  resumePendingNote: string;
  targetId: string;
  /** Small "Watch introduction" link (omitted when the section is hidden). */
  watchLabel?: string;
  watchTargetId?: string;
}

export function HeroActions(props: HeroActionsProps) {
  const { primaryLabel, secondaryLabel, resumeHref, resumeDownloadName, resumePendingNote, targetId, watchLabel, watchTargetId } = props;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Magnetic>
        <Button
          href={`/#${targetId}`}
          onClick={(e) => {
            e.preventDefault();
            scrollToTarget(targetId);
            history.replaceState(null, "", `#${targetId}`);
          }}
        >
          {primaryLabel}
          <span aria-hidden="true">→</span>
        </Button>
      </Magnetic>
      <Magnetic>
        {resumeHref ? (
          <Button href={resumeHref} variant="secondary" download={resumeDownloadName}>
            {secondaryLabel}
            <span aria-hidden="true">↓</span>
          </Button>
        ) : (
          <Button variant="secondary" disabled title={resumePendingNote} aria-label={`${secondaryLabel} — ${resumePendingNote}`}>
            {secondaryLabel}
            <span aria-hidden="true">↓</span>
          </Button>
        )}
      </Magnetic>
      {watchLabel && watchTargetId && (
        <a
          href={`/#${watchTargetId}`}
          onClick={(e) => {
            e.preventDefault();
            scrollToTarget(watchTargetId);
            history.replaceState(null, "", `#${watchTargetId}`);
          }}
          className="group ml-1 inline-flex min-h-11 items-center gap-2 rounded-chip px-2 text-sm text-fg-muted transition-colors hover:text-fg"
        >
          <span aria-hidden="true" className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-line-strong text-[10px] text-lavender transition-colors group-hover:border-lavender">
            ▶
          </span>
          {watchLabel}
        </a>
      )}
    </div>
  );
}
