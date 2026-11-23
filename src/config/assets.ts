/**
 * SITE-LEVEL ASSET SETTINGS (not page content).
 *
 * Photos, certificates, résumés and project files are set in the /content
 * files (e.g. content/hero.json → portrait.image). This file only holds
 * assets that are not part of any section.
 */
export const assets = {
  /** Open Graph preview image for link sharing (1200×630). */
  ogImage: "/og/og-image.png",

  /** Folders, for reference when adding files. */
  folders: {
    certificates: "/certificates/",
    photos: "/photos/",
    resumes: "/resumes/",
    projects: "/projects/", // /projects/<project-slug>/<file>
  },
} as const;
