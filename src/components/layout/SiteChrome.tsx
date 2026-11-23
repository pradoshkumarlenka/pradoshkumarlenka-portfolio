import { getSection } from "@/lib/content/server";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { CosmicBackground } from "@/components/scene/CosmicBackground";
import { CursorTrail } from "@/components/motion/CursorTrail";
import { PageTransition } from "@/components/motion/PageTransition";
import { SiteAnalytics } from "@/components/layout/SiteAnalytics";
import { isDraftPreview } from "@/lib/content/draft-source";

const ANALYTICS_ON = process.env.ENABLE_VERCEL_ANALYTICS === "1";

/** Public-site frame: smooth scroll, 3D background, cursor trail, navbar, footer. */
export async function SiteChrome({ children }: { children: React.ReactNode }) {
  const [showFooter, preview] = await Promise.all([getSection("footer").then(Boolean), isDraftPreview()]);
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-control focus:bg-surface focus:px-4 focus:py-2 focus:text-fg"
      >
        Skip to content
      </a>
      <SmoothScroll />
      {/* Persistent 3D environment behind all content (never intercepts input). */}
      <CosmicBackground />
      {/* Cursor light trail: above the sky, below all content. */}
      <CursorTrail />
      <Navbar />
      <main id="main" className="outline-none">{children}</main>
      {showFooter && <Footer />}
      <PageTransition />
      {/* Page views only for real visitors, never in the admin's draft preview — and only once
          Web Analytics is enabled in Vercel (ENABLE_VERCEL_ANALYTICS=1); otherwise its script
          does not exist and the browser would log errors. */}
      {ANALYTICS_ON && !preview && <SiteAnalytics />}
    </>
  );
}
