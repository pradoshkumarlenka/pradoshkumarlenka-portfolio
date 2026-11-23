/**
 * CONTENT REGISTRY — the one list of every content block on the site.
 *
 * Each block is one file in /content today (edited by hand, checked by
 * scripts/content.mjs). In a later phase the same blocks can also come from
 * the database; the JSON stays as the fallback, so the site never goes blank.
 *
 * This module is plain data (safe on server and client). Components never
 * import it directly — they get content through src/lib/content/server.ts
 * (server components) or the ContentProvider hooks (client components).
 */
import siteFile from "../../../content/site.json";
import sectionsFile from "../../../content/sections.json";
import heroFile from "../../../content/hero.json";
import proofFile from "../../../content/proof.json";
import experienceFile from "../../../content/experience.json";
import researchFile from "../../../content/research.json";
import leadershipFile from "../../../content/leadership.json";
import honoursFile from "../../../content/honours.json";
import beyondFile from "../../../content/beyond.json";
import resumeFile from "../../../content/resume.json";
import contactFile from "../../../content/contact.json";
import footerFile from "../../../content/footer.json";
import uiFile from "../../../content/ui.json";
import designFile from "../../../content/design.json";
import animationFile from "../../../content/animation.json";
import { projectFiles } from "@/content/generated/projects";
import type {
  AnimationFile,
  BeyondFile,
  ContactFile,
  DesignFile,
  ExperienceFile,
  FooterFile,
  HeroFile,
  HonoursFile,
  LeadershipFile,
  ProjectFile,
  ProofFile,
  ResearchFile,
  ResumeFile,
  SectionsFile,
  SiteFile,
  UiFile,
} from "@/content/types";

/** Shape of every content block, by key. */
export interface ContentMap {
  site: SiteFile;
  sections: SectionsFile;
  hero: HeroFile;
  proof: ProofFile;
  experience: ExperienceFile;
  research: ResearchFile;
  leadership: LeadershipFile;
  honours: HonoursFile;
  beyond: BeyondFile;
  resume: ResumeFile;
  contact: ContactFile;
  footer: FooterFile;
  ui: UiFile;
  /** Theme colours and corner rounding. */
  design: DesignFile;
  /** Motion settings (applied over ANIMATION_DEFAULTS, clamped to ANIMATION_LIMITS). */
  animation: AnimationFile;
  /** One block holding all project files (content/projects/*.json). */
  projects: ProjectFile[];
}
export type ContentKey = keyof ContentMap;

/** Validated by scripts/content.mjs before the site starts (JSON imports are typed loosely). */
const checked = <T>(value: unknown) => value as T;

/** Where each block lives today and which part of the site it feeds. */
export const CONTENT_REGISTRY: { [K in ContentKey]: { file: string; usedBy: string } } = {
  site: { file: "content/site.json", usedBy: "Page title, description, search/social metadata" },
  sections: { file: "content/sections.json", usedBy: "Section order, visibility, headings, navigation labels" },
  hero: { file: "content/hero.json", usedBy: "Hero, Meet Pradosh video, navbar monogram, page author" },
  proof: { file: "content/proof.json", usedBy: "Proof Bar" },
  experience: { file: "content/experience.json", usedBy: "Experience timeline" },
  research: { file: "content/research.json", usedBy: "Featured research block, Securitization X-Ray page" },
  leadership: { file: "content/leadership.json", usedBy: "Leadership bento" },
  honours: { file: "content/honours.json", usedBy: "Honours carousel, Certificate wall, Education" },
  beyond: { file: "content/beyond.json", usedBy: "Beyond the Classroom carousel" },
  resume: { file: "content/resume.json", usedBy: "Résumé Library, Hero résumé button" },
  contact: { file: "content/contact.json", usedBy: "Contact" },
  footer: { file: "content/footer.json", usedBy: "Footer" },
  ui: { file: "content/ui.json", usedBy: "Shared labels: navigation, buttons, viewers, charts, messages" },
  design: { file: "content/design.json", usedBy: "Theme colours (accents, text, cards, charts) and corner rounding" },
  animation: { file: "content/animation.json", usedBy: "Scroll reveals, smooth scrolling, hero timing, cursor trail, counters, carousels" },
  projects: { file: "content/projects/*.json", usedBy: "Project cards (extras), the five case-study pages" },
};

/** The bundled JSON content — the permanent fallback for every block. */
export const STATIC_CONTENT: ContentMap = {
  site: checked<SiteFile>(siteFile),
  sections: checked<SectionsFile>(sectionsFile),
  hero: checked<HeroFile>(heroFile),
  proof: checked<ProofFile>(proofFile),
  experience: checked<ExperienceFile>(experienceFile),
  research: checked<ResearchFile>(researchFile),
  leadership: checked<LeadershipFile>(leadershipFile),
  honours: checked<HonoursFile>(honoursFile),
  beyond: checked<BeyondFile>(beyondFile),
  resume: checked<ResumeFile>(resumeFile),
  contact: checked<ContactFile>(contactFile),
  footer: checked<FooterFile>(footerFile),
  ui: checked<UiFile>(uiFile),
  design: checked<DesignFile>(designFile),
  animation: checked<AnimationFile>(animationFile),
  projects: projectFiles.map((p) => checked<ProjectFile>(p)),
};
