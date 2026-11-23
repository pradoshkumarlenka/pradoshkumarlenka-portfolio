"use client";

import { createContext, useContext, type ReactNode } from "react";
import { STATIC_CONTENT } from "./registry";
import { navItemsFrom } from "./selectors";
import { ANIMATION_DEFAULTS } from "@/lib/animation/config";
import type { ClientContent } from "./types";

/*
 * CONTENT ACCESS (client) — client components read content through these
 * hooks instead of importing JSON. The root layout resolves the values on the
 * server (src/lib/content/server.ts) and passes them to <ContentProvider>,
 * so a future database source reaches client components with no changes here.
 */

/** Used only if a component renders outside the provider: the bundled JSON. */
const FALLBACK: ClientContent = {
  ui: STATIC_CONTENT.ui,
  person: STATIC_CONTENT.hero.person,
  navItems: navItemsFrom(STATIC_CONTENT.sections.sections),
  animation: ANIMATION_DEFAULTS,
};

const ContentContext = createContext<ClientContent>(FALLBACK);

export function ContentProvider({ value, children }: { value: ClientContent; children: ReactNode }) {
  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>;
}

/** Shared interface labels (content/ui.json). */
export const useUi = () => useContext(ContentContext).ui;
/** Name, monogram and other person details (content/hero.json → person). */
export const usePerson = () => useContext(ContentContext).person;
/** Navigation entries (content/sections.json). */
export const useNavItems = () => useContext(ContentContext).navItems;
/** Animation parameters (src/lib/animation/config.ts). */
export const useAnimationConfig = () => useContext(ContentContext).animation;
