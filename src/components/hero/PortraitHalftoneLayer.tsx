"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { useAnimationConfig } from "@/lib/content/client";

const HalftoneReveal = dynamic(() => import("@/components/reactbits/HalftoneReveal"), { ssr: false });

/**
 * Interactive halftone print of the real portrait (React Bits HalftoneReveal).
 * The dots are computed from the supplied photo itself (mono cream ink on
 * dark paper, backdrop unprinted); the cursor reveals the untouched photo.
 *
 * Only for mouse users with WebGL2 and full motion. Everyone else keeps the
 * clear photo (with its CSS dots-to-clear intro) rendered beneath this layer.
 *
 * Staged: mounts after the Hero text entrance (hero.portraitEntranceMs) so the two
 * animations never compete for frames; its own dots-grow-in intro then plays.
 * For these visitors CSS keeps the photo underneath transparent (see
 * .portrait-card in globals.css); if WebGL2 is missing the card is marked
 * data-halftone="off" and the clear photo shows instead.
 */
interface PortraitHalftoneLayerProps {
  src: string;
  /** Background the dots are printed on. */
  paperColor: string;
  /** The photo's plain backdrop colour, left unprinted so the figure floats on the paper. */
  backdropColor: string;
}

export function PortraitHalftoneLayer({ src, paperColor, backdropColor }: PortraitHalftoneLayerProps) {
  const ENTRANCE_MS = useAnimationConfig().hero.portraitEntranceMs;
  const [enabled, setEnabled] = useState(false);
  const marker = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fine = matchMedia("(pointer: fine)").matches;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!fine || reduced) return; // CSS already shows the clear photo
    const probe = document.createElement("canvas").getContext("webgl2");
    probe?.getExtension("WEBGL_lose_context")?.loseContext();
    if (!probe) {
      marker.current?.closest("figure")?.setAttribute("data-halftone", "off");
      return;
    }
    // Hero already seen this page load → no entrance to wait for.
    const seen = document.getElementById("hero")?.classList.contains("hero-static");
    const id = window.setTimeout(() => setEnabled(true), seen ? 0 : ENTRANCE_MS);
    return () => window.clearTimeout(id);
  }, [ENTRANCE_MS]);

  if (!enabled) return <div ref={marker} hidden />;
  return (
    <div className="absolute inset-0">
      {/* Matches the React Bits reference look: one cream ink on dark paper. */}
      <HalftoneReveal
        src={src}
        fit="cover"
        mode="mono"
        shape="dot"
        cellSize={6}
        angle={45}
        inkColor="#f4f1ea"
        paperColor={paperColor}
        revealRadius={150}
        knockout={backdropColor}
      />
    </div>
  );
}
