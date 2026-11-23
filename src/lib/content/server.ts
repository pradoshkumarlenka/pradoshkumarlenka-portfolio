import "server-only";
import { cache } from "react";
import type { ProjectFile, SectionConfig, SectionId } from "@/content/types";
import { STATIC_CONTENT, type ContentKey, type ContentMap } from "./registry";
import { SOURCES } from "./source";
import { findSection, navItemsFrom, orderSections, sortProjects } from "./selectors";
import { getAnimationConfig } from "@/lib/animation/server";
import type { ClientContent } from "./types";
import { designOverridesCss } from "@/lib/design/tokens";

/*
 * CONTENT ACCESS (server) — the only way server code reads site content.
 * Each block is resolved once per request (React cache), from the first
 * source that has it, with the bundled JSON as the final fallback.
 */

/** One content block. Never throws: a failing source falls through to the next. */
export const getContent = cache(async <K extends ContentKey>(key: K): Promise<ContentMap[K]> => {
  for (const source of SOURCES) {
    try {
      const value = await source.get(key);
      if (value != null) return value;
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.warn(`[content] source "${source.name}" failed for "${key}":`, e);
    }
  }
  return STATIC_CONTENT[key];
});

/** Site metadata plus the public site URL (NEXT_PUBLIC_SITE_URL in production). */
export async function getSite() {
  const site = await getContent("site");
  return { ...site, url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000" };
}

/** Visible sections in display order. */
export async function getOrderedSections(): Promise<SectionConfig[]> {
  return orderSections((await getContent("sections")).sections);
}

/** A visible section by id (undefined if hidden). */
export async function getSection(id: SectionId): Promise<SectionConfig | undefined> {
  return findSection((await getContent("sections")).sections, id);
}

/** All projects in order, and the ones with a case-study page. */
export async function getProjects(): Promise<ProjectFile[]> {
  return sortProjects(await getContent("projects"));
}
export async function getCaseStudyProjects(): Promise<ProjectFile[]> {
  return (await getProjects()).filter((p) => p.caseStudy);
}

/** What client components need, resolved on the server and handed to <ContentProvider>. */
export async function getClientContent(): Promise<ClientContent> {
  const [ui, hero, sections, animation] = await Promise.all([getContent("ui"), getContent("hero"), getContent("sections"), getAnimationConfig()]);
  return { ui, person: hero.person, navItems: navItemsFrom(sections.sections), animation };
}

/** CSS variable overrides from the published "design" block ("" = the default theme, nothing emitted). */
export async function getThemeCss(): Promise<string> {
  return designOverridesCss(await getContent("design"), STATIC_CONTENT.design);
}
