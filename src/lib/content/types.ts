import type { Person, UiFile } from "@/content/types";
import type { AnimationConfig } from "@/lib/animation/config";
import type { NavItem } from "./selectors";

/** The slice of content that client components read (via <ContentProvider>). */
export interface ClientContent {
  ui: UiFile;
  person: Person;
  navItems: NavItem[];
  animation: AnimationConfig;
}
