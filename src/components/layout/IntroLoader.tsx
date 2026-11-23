/**
 * INTRO LOADER — first visit only, ~1.1 s, never blocks the page.
 *
 * Pure HTML + CSS (no JavaScript bundle): a thin accent line draws across, the
 * monogram fades in with a 000 → 100 counter, then the screen opens like a vault
 * door onto the Hero. It is click-through (pointer-events: none), aria-hidden and
 * never takes focus, so keyboard and screen-reader users reach the content at once.
 *
 * INTRO_SCRIPT (inlined at the top of <body> by the root layout) runs before anything is
 * painted and skips it when:
 *   - the first page opened is not the home page (so in-site navigation never plays it),
 *   - it has already played in this browser (localStorage), or
 *   - the visitor prefers reduced motion.
 * It also marks it finished, so returning to the home page within the site never
 * replays it. If scripts are blocked it simply plays once and removes itself (CSS).
 * Shown only when the "loader" section is visible (content/sections.json).
 */
export const INTRO_SCRIPT = `(function(){var d=document.documentElement;if(location.pathname!=='/'){d.dataset.intro='skip';return;}try{var r=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;if(d.dataset.intro||r||localStorage.getItem('pkl-intro')==='seen'){d.dataset.intro=d.dataset.intro||'skip';return;}localStorage.setItem('pkl-intro','seen');}catch(e){}d.dataset.intro='play';setTimeout(function(){d.dataset.intro='done';},1400);})();`;

export function IntroLoader({ monogram }: { monogram: string }) {
  return (
    <>
      <div className="intro-loader" aria-hidden="true">
        <div className="intro-loader__panel intro-loader__panel--top" />
        <div className="intro-loader__panel intro-loader__panel--bottom" />
        <div className="intro-loader__core">
          <span className="intro-loader__line" />
          <span className="intro-loader__mono">{monogram}</span>
          <span className="intro-loader__count" />
        </div>
      </div>
    </>
  );
}
