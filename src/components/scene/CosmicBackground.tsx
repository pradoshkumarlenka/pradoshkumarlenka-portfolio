"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollTrigger } from "@/lib/gsap";
import { emitSceneScroll, onSceneScroll, sceneMotion, sceneScroll } from "./scrollState";
import { detectQuality, type SceneQuality } from "./sceneConfig";

/**
 * PERSISTENT COSMIC BACKGROUND
 *
 * One fixed layer behind every page, mounted once in the root layout so it
 * never remounts between sections or routes. It never receives pointer
 * events. Three.js loads after first paint; until then (and on devices
 * without WebGL) a lightweight CSS sky is shown.
 */

const CosmicScene = dynamic(() => import("./CosmicScene"), { ssr: false });

function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") ?? canvas.getContext("webgl");
    gl?.getExtension("WEBGL_lose_context")?.loseContext(); // release the probe context
    return Boolean(gl);
  } catch {
    return false;
  }
}

/** Keeps a WebGL failure from taking down the page: falls back to the CSS sky. */
class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The single scroll source for the background: one ScrollTrigger (kept in
 * sync with Lenis) writes whole-page progress and Hero exit progress.
 */
function useSceneScrollDriver() {
  const pathname = usePathname();

  useEffect(() => {
    let heroEnd = 0;

    const measure = () => {
      const hero = document.getElementById("hero");
      heroEnd = hero ? hero.getBoundingClientRect().bottom + window.scrollY : 0;
    };

    const update = (progress: number) => {
      sceneScroll.progress = progress;
      sceneScroll.hero = heroEnd > 0 ? Math.min(1, Math.max(0, window.scrollY / heroEnd)) : 1;
      emitSceneScroll();
    };

    const trigger = ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: (self) => update(self.progress),
      onRefresh: (self) => {
        measure();
        update(self.progress);
      },
    });
    measure();
    update(trigger.progress);

    // Section heights change as content/images load: keep the range accurate.
    // A refresh recalculates every scroll animation (pinned carousels included), so it
    // only runs when the page height really changed, once per burst of changes.
    let timer = 0;
    let lastHeight = document.body.scrollHeight;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        const h = document.body.scrollHeight;
        if (Math.abs(h - lastHeight) < 2) return;
        lastHeight = h;
        ScrollTrigger.refresh();
      }, 300);
    });
    observer.observe(document.body);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
      trigger.kill();
    };
  }, [pathname]);

  // Development only: expose scroll state for debugging and automated checks.
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      (window as Window & { __cosmic?: unknown }).__cosmic = { sceneScroll, sceneMotion };
    }
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      sceneScroll.reducedMotion = media.matches;
      emitSceneScroll();
    };
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);
}

/** Lightweight sky + horizon used before WebGL loads and as the no-WebGL fallback. */
function StaticSky() {
  const ground = useRef<SVGSVGElement>(null);

  useEffect(
    () =>
      onSceneScroll(() => {
        const t = Math.min(1, Math.max(0, (sceneScroll.hero - 0.04) / 0.56));
        if (ground.current) ground.current.style.opacity = String(1 - t * t * (3 - 2 * t));
      }),
    [],
  );

  return (
    <div className="absolute inset-0 bg-canvas">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60rem 40rem at 8% 6%, rgb(76 62 140 / 0.16), transparent 60%), radial-gradient(40rem 30rem at 100% 48%, rgb(80 72 160 / 0.1), transparent 60%), linear-gradient(to bottom, #05070f, #070a14 55%, #0a0c1b)",
        }}
      />
      <svg
        ref={ground}
        className="absolute inset-x-0 bottom-0 h-[22vh] w-full"
        viewBox="0 0 1600 220"
        preserveAspectRatio="none"
      >
        <path
          d="M0 40 L90 70 L170 52 L260 96 L360 120 L470 150 L600 168 L760 176 L900 172 L1040 166 L1160 150 L1260 124 L1350 100 L1440 74 L1520 46 L1600 30 L1600 220 L0 220 Z"
          fill="#05060c"
        />
      </svg>
    </div>
  );
}

export function CosmicBackground() {
  const [quality, setQuality] = useState<SceneQuality | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useSceneScrollDriver();

  // Load WebGL only once the first view is complete: the Hero name has painted
  // ("hero-name-ready", at most 4 s, home page only), the page has finished loading
  // (window "load") and the browser is idle. On fast devices all three happen almost
  // at once; on slow phones the 3D scene no longer competes with hydration and the
  // hero image. The static sky (same colours and horizon) shows until then.
  useEffect(() => {
    let cancelled = false;
    let idle = 0;
    let timer = 0;
    const start = () => {
      if (cancelled) return;
      if (supportsWebGL()) setQuality(detectQuality());
      else setFailed(true);
    };
    const afterLoad = (fn: () => void) => {
      if (document.readyState === "complete") fn();
      else window.addEventListener("load", fn, { once: true });
    };
    const whenIdle = () => {
      window.removeEventListener("hero-name-ready", ready);
      window.clearTimeout(timer);
      // Safari has no requestIdleCallback: fall back to a short timeout.
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(start, { timeout: 3000 });
      else timer = window.setTimeout(start, 300);
    };
    const nameReady = (window as Window & { __heroNameReady?: boolean }).__heroNameReady;
    let started = false;
    const ready = () => {
      if (started) return;
      started = true;
      afterLoad(whenIdle);
    };
    if (document.getElementById("hero") && !nameReady) {
      window.addEventListener("hero-name-ready", ready);
      timer = window.setTimeout(ready, 4000);
    } else ready();
    return () => {
      cancelled = true;
      window.removeEventListener("hero-name-ready", ready);
      window.removeEventListener("load", whenIdle);
      window.clearTimeout(timer);
      if (idle && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 select-none overflow-hidden">
      <StaticSky />
      {quality && !failed && (
        <SceneBoundary onError={() => setFailed(true)}>
          <div
            className={`absolute inset-0 transition-opacity duration-[1200ms] ease-premium ${
              ready ? "opacity-100" : "opacity-0"
            }`}
          >
            <CosmicScene quality={quality} onReady={() => setReady(true)} onContextLost={() => setFailed(true)} />
          </div>
        </SceneBoundary>
      )}
    </div>
  );
}
