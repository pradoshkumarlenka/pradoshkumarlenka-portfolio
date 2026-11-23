"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useAnimationConfig } from "@/lib/content/client";

const GlowCursor = dynamic(() => import("@/components/reactbits/GlowCursor"), { ssr: false });

/* Starts after the Hero entrance (cursorTrail.startAfterMs) so the fluid sim never competes with it. */

/**
 * Site-wide cursor light trail (React Bits GlowCursor).
 *
 * Isolation from the rest of the page:
 *  - One fixed, full-viewport layer at z-index -5: above the cosmic
 *    background (-10), below ALL page content, so the light shows in the sky
 *    but never draws over the Hero name, portrait, text or cards.
 *  - pointer-events: none; it only listens to window pointer events.
 *  - Mouse + full-motion visitors only; mounts after the Hero entrance.
 */
export function CursorTrail() {
  const [on, setOn] = useState(false);
  const t = useAnimationConfig().cursorTrail;

  useEffect(() => {
    if (!t.enabled || !matchMedia("(pointer: fine)").matches || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // The trail is only visible while the mouse moves, so the fluid simulation (module,
    // shaders, framebuffers) starts on the first mouse movement after startAfterMs —
    // a page that is only being read pays nothing, and what visitors see is unchanged.
    let cancelled = false;
    const start = () => {
      window.removeEventListener("pointermove", onMove);
      const idle = window.requestIdleCallback ?? ((cb: () => void) => window.setTimeout(cb, 0));
      idle(() => {
        if (cancelled) return;
        // Needs WebGL2 + float render targets; otherwise skip (no empty canvas).
        const gl = document.createElement("canvas").getContext("webgl2");
        const supported = Boolean(gl?.getExtension("EXT_color_buffer_float"));
        gl?.getExtension("WEBGL_lose_context")?.loseContext();
        if (supported) setOn(true);
      });
    };
    const onMove = (e: PointerEvent) => { if (e.pointerType === "mouse" || e.pointerType === "pen") start(); };
    const id = window.setTimeout(() => {
      window.addEventListener("pointermove", onMove, { passive: true });
      // Fetch the code ahead (cheap); the expensive WebGL set-up still waits for the mouse.
      void import("@/components/reactbits/GlowCursor").catch(() => {});
    }, t.startAfterMs);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
      window.removeEventListener("pointermove", onMove);
    };
  }, [t.enabled, t.startAfterMs]);

  if (!on) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-[5]">
      <GlowCursor
        color={t.color}
        secondaryColor={t.secondaryColor}
        intensity={t.intensity}
        trailWidth={t.trailWidth}
        linger={t.linger}
        glow={t.glow}
        hotspot={t.hotspot}
        followSpeed={t.followSpeed}
        clickBurst={t.clickBurst}
        quality="medium"
        maxDevicePixelRatio={1}
        theme="dark"
      />
    </div>
  );
}
