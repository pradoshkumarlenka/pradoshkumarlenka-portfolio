/**
 * Pure helpers that derive what components need from content blocks.
 * No data access here (safe on server and client).
 */
import type { ProjectFile, SectionConfig, SectionId } from "@/content/types";

/** Visible sections in display order. */
export function orderSections(sections: SectionConfig[]): SectionConfig[] {
  return sections.filter((s) => s.visible).sort((a, b) => a.order - b.order);
}

export type NavItem = { id: SectionId; label: string };

/** Navigation entries: visible sections that have a navLabel. */
export function navItemsFrom(sections: SectionConfig[]): NavItem[] {
  return orderSections(sections)
    .filter((s): s is SectionConfig & { navLabel: string } => Boolean(s.navLabel))
    .map((s) => ({ id: s.id, label: s.navLabel }));
}

/** A visible section by id (undefined if hidden or missing). */
export function findSection(sections: SectionConfig[], id: SectionId): SectionConfig | undefined {
  return orderSections(sections).find((s) => s.id === id);
}

/** Projects in their `order`. */
export function sortProjects(projects: ProjectFile[]): ProjectFile[] {
  return [...projects].sort((a, b) => a.order - b.order);
}

/** Fills {placeholders} in label text, e.g. fill("Page {n}", { n: 2 }). */
export function fill(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}
