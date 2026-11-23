import { Suspense } from "react";
import type { Metadata } from "next";
import type { SectionConfig } from "@/content/types";
import { Section } from "@/components/ui/Section";
import { Hero } from "@/components/hero/Hero";
import { ProofBar } from "@/components/sections/ProofBar";
import { ExperienceTimeline } from "@/components/sections/ExperienceTimeline";
import { ResearchWork } from "@/components/sections/ResearchWork";
import { Leadership } from "@/components/sections/Leadership";
import { BeyondClassroom } from "@/components/sections/beyond/BeyondClassroom";
import { ResumeLibrary } from "@/components/sections/ResumeLibrary";
import { IntroVideo } from "@/components/sections/IntroVideo";
import { ContactSection } from "@/components/sections/ContactSection";
import { HonoursCredentials } from "@/components/sections/honours/HonoursCredentials";
import { IntroLoader } from "@/components/layout/IntroLoader";
import type { ContentMap } from "@/lib/content/registry";
import { getContent, getOrderedSections, getSite } from "@/lib/content/server";
import fs from "node:fs";
import path from "node:path";
import { resolveAsset } from "@/lib/assets.server";
import { mediaIdFromPath } from "@/lib/media/paths";
import { getPublicMedia } from "@/lib/media/server";

/** The home page is the canonical address of the site root. */
export const metadata: Metadata = { alternates: { canonical: "/" } };

/** Content blocks the homepage sections read (resolved through src/lib/content). */
const HOME_BLOCKS = ["hero", "proof", "experience", "leadership", "honours", "beyond", "resume", "contact"] as const;
type ResumeInfo = { src: string | null; size: string | null };
type HomeContent = Pick<ContentMap, (typeof HOME_BLOCKS)[number]> & { resumeInfo: ResumeInfo; variantInfo: Record<string, ResumeInfo> };

/** Résumé file (null if missing) and its size for the label. Library files (/media/…) report their stored size. */
async function resumeFileInfo(file: string) {
  const src = resolveAsset(file);
  if (!src) return { src, size: null };
  const mediaId = mediaIdFromPath(src);
  if (mediaId) {
    const info = await getPublicMedia(mediaId);
    return { src, size: info ? `${Math.round(info.bytes / 1024)} KB` : null };
  }
  return { src, size: `${Math.round(fs.statSync(path.join(process.cwd(), "public", src)).size / 1024)} KB` };
}

/** Research & Selected Work comes from the database: re-checked at least every 60 s,
 *  and immediately whenever the admin dashboard changes something (revalidatePath). */
export const revalidate = 60;

/**
 * HOMEPAGE — renders the visible sections (content/sections.json) in their `order`.
 * All content is read through src/lib/content (JSON today, database-ready).
 */

function renderSection(section: SectionConfig, c: HomeContent) {
  const { hero, proof, experience, leadership, honours, beyond, resume, contact } = c;
  switch (section.id) {
    case "loader":
      return <IntroLoader key={section.id} monogram={hero.person.monogram} />;
    case "footer": // Rendered by the root layout.
      return null;
    case "hero":
      return <Hero key={section.id} />;
    case "intro":
      return (
        <Section key={section.id} config={section} spacing="compact">
          <IntroVideo video={hero.introVideo} src={resolveAsset(hero.introVideo.src)} />
        </Section>
      );
    case "proof":
      return (
        <Section key={section.id} config={section} animateContent={false} spacing="compact">
          <ProofBar items={proof.items} />
        </Section>
      );
    case "research-work":
      return (
        <Section key={section.id} config={section} animateContent={false}>
          <ResearchWork />
        </Section>
      );
    case "experience":
      return (
        <Section key={section.id} config={section} animateContent={false}>
          <ExperienceTimeline items={experience.items} />
        </Section>
      );
    case "leadership":
      return (
        <Section key={section.id} config={section} animateContent={false}>
          <Leadership items={leadership.items} />
        </Section>
      );
    case "honours":
      return (
        // overflow-x-clip: the carousel's outer cards may extend past the screen edge.
        <Section key={section.id} config={section} className="overflow-x-clip">
          <HonoursCredentials
            honours={honours.honours}
            archive={honours.archive}
            certificates={honours.certifications
              .filter((cert) => cert.visible !== false)
              .map((cert) => ({ ...cert, imageSrc: resolveAsset(cert.image), downloadSrc: resolveAsset(cert.download) }))}
            education={honours.education}
            educationNotes={honours.educationNotes}
            labels={honours.labels}
          />
        </Section>
      );
    case "beyond":
      return (
        // overflow-x-clip: the carousel runs the full screen width.
        <Section key={section.id} config={section} className="overflow-x-clip">
          <BeyondClassroom items={beyond.items} labels={beyond.labels} />
        </Section>
      );
    case "resume":
      return (
        <Section key={section.id} config={section}>
          <ResumeLibrary resume={resume} {...c.resumeInfo} variantInfo={c.variantInfo} />
        </Section>
      );
    case "contact":
      return (
        <Section key={section.id} config={section}>
          <ContactSection contact={contact} headshot={resolveAsset(contact.headshot)} />
        </Section>
      );
    default:
      return null;
  }
}

export default async function HomePage() {
  const [sections, ...blocks] = await Promise.all([getOrderedSections(), ...HOME_BLOCKS.map((k) => getContent(k))]);
  const content = Object.fromEntries(HOME_BLOCKS.map((k, i) => [k, blocks[i]])) as Omit<HomeContent, "resumeInfo" | "variantInfo">;
  const variants = content.resume.variants ?? [];
  const [resumeInfo, site, ...variantFiles] = await Promise.all([
    resumeFileInfo(content.resume.file),
    getSite(),
    ...variants.map((v) => (v.file ? resumeFileInfo(v.file) : Promise.resolve({ src: null, size: null }))),
  ]);
  const variantInfo = Object.fromEntries(variants.map((v, i) => [v.id, variantFiles[i]]));
  // schema.org Person (search engines). Facts only from the published content; "<" escaped.
  const person = content.hero.person;
  const linkedin = content.contact.links.find((l) => l.kind === "linkedin")?.href;
  const email = content.contact.links.find((l) => l.kind === "email")?.href.replace(/^mailto:/, "");
  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.name,
    url: site.url,
    description: site.description,
    jobTitle: person.tagline,
    address: { "@type": "PostalAddress", addressLocality: person.location },
    ...(email ? { email } : {}),
    ...(linkedin ? { sameAs: [linkedin] } : {}),
  }).replace(/</g, "\\u003c");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      {sections.map((section) => {
        const el = renderSection(section, { ...content, resumeInfo, variantInfo });
        // Below the Hero, each section is its own Suspense boundary: the server HTML is identical
        // (nothing suspends in it), but React hydrates the sections as separate, interruptible
        // units after the Hero instead of in one long main-thread task (faster first input).
        return el && section.id !== "hero" && section.id !== "loader" ? <Suspense key={section.id}>{el}</Suspense> : el;
      })}
    </>
  );
}
