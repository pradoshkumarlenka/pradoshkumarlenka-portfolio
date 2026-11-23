import type { Metadata, Viewport } from "next";
import "./globals.css";
import { fontVariables } from "./fonts";
import { getClientContent, getContent, getSite, getThemeCss } from "@/lib/content/server";
import { ContentProvider } from "@/lib/content/client";
import { PreviewBanner } from "@/components/layout/PreviewBanner";
import { INTRO_SCRIPT } from "@/components/layout/IntroLoader";

export async function generateMetadata(): Promise<Metadata> {
  const [site, hero] = await Promise.all([getSite(), getContent("hero")]);
  const { person } = hero;
  return {
    metadataBase: new URL(site.url),
    title: { default: site.title, template: `%s · ${person.name}` },
    description: site.description,
    authors: [{ name: person.name }],
    openGraph: {
      type: "website",
      locale: site.locale,
      title: site.title,
      description: site.description,
      siteName: person.name,
      url: "/",
    },
    twitter: { card: "summary_large_image", title: site.title, description: site.description },
  };
}

export const viewport: Viewport = {
  themeColor: "#070a14",
  colorScheme: "dark",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Content for client components, resolved once on the server (src/lib/content).
  const [clientContent, themeCss] = await Promise.all([getClientContent(), getThemeCss()]);
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      {/* Theme overrides from the Design editor; absent with the default design. Values are validated hex/px only. */}
      {themeCss ? (
        <head>
          <style id="theme-overrides">{themeCss}</style>
        </head>
      ) : null}
      {/* The public site frame lives in (site)/layout.tsx; /admin has its own plain layout. */}
      <body id="top">
        {/* Decides before the first paint whether the first-visit intro plays (IntroLoader.tsx). */}
        <script dangerouslySetInnerHTML={{ __html: INTRO_SCRIPT }} />
        <ContentProvider value={clientContent}>{children}</ContentProvider>
        <PreviewBanner />
      </body>
    </html>
  );
}
