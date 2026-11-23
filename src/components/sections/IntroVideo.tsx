"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { IntroVideo as IntroVideoContent } from "@/content/types";
import { ViewerStatus } from "@/components/viewers/ViewerModal";

/**
 * MEET PRADOSH — the introduction video (content/hero.json → introVideo).
 * A 16:9 stage (portrait videos sit at their true 9:16 shape on a blurred
 * backdrop; on phones the stage turns portrait so the video stays large).
 * Nothing downloads until play is pressed (preload="none"); it never autoplays.
 * Playback uses the browser's own accessible controls (keyboard included).
 * Portrait poster: the play button sits in the frame's gold ring, clear of the face.
 */
export function IntroVideo({ video, src }: { video: IntroVideoContent; src: string | null }) {
  const player = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  const portrait = video.orientation === "portrait";

  const play = () => {
    setStarted(true);
    // Start inside the click so browsers allow playback with sound.
    requestAnimationFrame(() => {
      const el = player.current;
      if (!el) return;
      el.focus();
      el.play().catch(() => {
        /* The user can still press play on the native controls. */
      });
    });
  };

  const stage = portrait
    ? "relative mx-auto aspect-[9/16] max-h-[78vh] w-full max-w-[24rem] sm:aspect-video sm:max-h-none sm:max-w-none"
    : "relative aspect-video w-full";

  return (
    <div>
      <p className="mb-8 max-w-2xl text-lg leading-relaxed text-fg-muted">{video.description}</p>
      <div className={`${stage} overflow-hidden rounded-panel border border-line bg-canvas shadow-card`}>
        {!src || failed ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <ViewerStatus kind="error">{video.missing}</ViewerStatus>
          </div>
        ) : (
          <>
            {portrait && video.backdrop && (
              <Image src={video.backdrop} alt="" fill sizes="100vw" className="hidden object-cover sm:block" aria-hidden="true" />
            )}
            {/* The video column: full stage on phones, a centred 9:16 column on wider screens. */}
            <div className={portrait ? "absolute inset-0 sm:inset-y-0 sm:left-1/2 sm:right-auto sm:aspect-[9/16] sm:-translate-x-1/2" : "absolute inset-0"}>
              {started ? (
                <video
                  ref={player}
                  src={src}
                  poster={video.poster}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => setFailed(true)}
                  className="h-full w-full bg-black object-contain"
                  aria-label="Meet Pradosh — introduction video"
                >
                  {video.captions && <track kind="captions" src={video.captions} srcLang="en" label="English" default />}
                </video>
              ) : (
                <button type="button" onClick={play} aria-label={`${video.playLabel} (${video.duration})`} className="group absolute inset-0 block h-full w-full">
                  <Image src={video.poster} alt="" fill sizes="(min-width: 640px) 360px, 100vw" className="object-cover" />
                  <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-canvas/70 via-transparent to-transparent" />
                  <span
                    aria-hidden="true"
                    className={`absolute left-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center ${portrait ? "top-[23%]" : "top-1/2 sm:h-20 sm:w-20"} justify-center rounded-full border border-white/40 bg-canvas/55 backdrop-blur-sm transition-[transform,background-color,border-color] duration-300 ease-premium group-hover:scale-105 group-hover:border-lavender group-hover:bg-violet/70 group-focus-visible:border-lavender group-focus-visible:bg-violet/70 motion-reduce:transition-none motion-reduce:group-hover:scale-100`}
                  >
                    <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6 fill-white">
                      <path d="M8 5.5v13a.75.75 0 0 0 1.14.64l10.4-6.5a.75.75 0 0 0 0-1.28L9.14 4.86A.75.75 0 0 0 8 5.5Z" />
                    </svg>
                  </span>
                  <span aria-hidden="true" className="tabular absolute bottom-4 left-1/2 -translate-x-1/2 rounded-chip bg-canvas/70 px-3 py-1 font-mono text-xs text-fg">
                    ▶ {video.duration}
                  </span>
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
