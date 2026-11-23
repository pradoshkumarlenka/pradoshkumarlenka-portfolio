# Pradosh Kumar Lenka — Portfolio

Personal finance portfolio. Next.js 16 · TypeScript · Tailwind CSS 4 · GSAP + ScrollTrigger · Lenis ·
React Three Fiber (3D, later phase) · Recharts (charts, later phase).

The site has **one permanent dark theme**. There is no light theme and no theme toggle.

---

## 1. Run it locally

Requires Node.js 20 or newer.

```bash
npm install        # first time only
npm run dev        # http://localhost:3000
```

Other commands:

| Command             | What it does                                 |
| ------------------- | -------------------------------------------- |
| `npm run build`     | Production build (run before deploying)      |
| `npm start`         | Serve the production build locally           |
| `npm run lint`      | Check code style and common mistakes         |
| `npm run typecheck` | Check TypeScript types                       |

---

## 2. Where things live

```
src/
  content/content.ts     ← loader only (reads the /content folder; no text here)
  content/types.ts       ← the shape of that content (rarely edited)
  config/assets.ts       ← Open Graph image + folder reference
  styles/theme.css       ← ALL colours, fonts, radii, shadows, easing
  app/fonts.ts           ← which font families are loaded
  app/page.tsx           ← homepage (renders sections in order)
  app/projects/[slug]/   ← one detail page per project
  components/layout/     ← navigation, reading progress, footer
  components/ui/         ← Section, Card, Badge, Button, MediaFrame,
                           ProjectResources, CertificateCard
  components/motion/     ← SmoothScroll (Lenis), Reveal (GSAP)
  lib/                   ← helpers (asset checks, section order, GSAP setup)
public/
  certificates/  photos/  resumes/  projects/  og/
design-reference/        ← visual references, NOT published
```

---

## 3. Update content

**All visible text, numbers, images and links live in the `content/` folder** — plain `.json` files,
one per section, one per project (`content/projects/`), plus `content/ui.json` for buttons and labels.
Step-by-step guide for non-programmers: **[content/HOW-TO-EDIT.md](content/HOW-TO-EDIT.md)**.

Every content file is checked automatically before `npm run dev` / `npm run build`
(`npm run check:content` runs it on its own). Mistakes are reported in plain English with the
file and position; VS Code also underlines them as you type. The checks come from
`src/content/types.ts` (schemas are regenerated into `content/schemas/` on every check).

- **Missing facts:** write `[ADD]` rather than guessing.
- **Hide / show / reorder a section:** in `sections`, set `visible: false` or change `order`. The navigation updates automatically.
- **Research status:** change `research.status` to `"ongoing"`, `"completed"` or `"published"`; every badge follows.
- **Keep facts consistent:** if a number changes (e.g. in research), also update it in `proof`.

---

## 4. Replace images

Images live in `/public` and are referenced by path. **If a file is missing, the site shows a labelled
placeholder instead of a broken image**, so you can add files in any order.

| Image                  | Put it at                                   | Referenced in                        |
| ---------------------- | ------------------------------------------- | ------------------------------------ |
| Formal headshot        | `public/photos/headshot.webp`               | `content/hero.json` → `portrait.image` |
| Event photos           | `public/photos/<name>.webp`                 | `content/beyond.json` → `items[].image` |
| Open Graph image       | `public/og/og-image.png` (1200×630)         | `src/config/assets.ts` → `ogImage`   |

To replace an image, overwrite the file with the same name — or put a new file in and change the path.
Prefer **WebP**. To convert a PNG/JPG (sharp is already installed):

```bash
node -e "require('sharp')('input.jpg').webp({quality:86}).toFile('public/photos/output.webp')"
```

---

## 5. Add a certificate

**Privacy first:** blur signatures; remove enrolment/roll numbers, certificate codes and dates of birth.

1. Export the certificate as an image and save it as `public/certificates/<short-name>.webp`.
2. In `content/honours.json` → `certifications`, add (or edit) an entry:

```ts
{
  name: "Certificate name",
  issuer: "Issuing body",
  year: "2026",
  category: "Finance",              // "Finance" | "Analytics" | "Professional"
  image: "/certificates/short-name.webp",
  verifyUrl: "https://www.credly.com/badges/…",   // or null
},
```

The credential wall grows automatically.

---

## 6. Attach project resources (decks, models, reports, links)

Each project file in `content/projects/` has a `resources` list. **When the list is empty, the
"Project resources" panel does not appear at all.** Only add files that really exist.

1. Put the file in `public/projects/<project-slug>/`, e.g. `public/projects/dfi-bond-portfolio/bond-model.xlsx`.
2. Add an entry:

```ts
resources: [
  {
    title: "Yield, duration & convexity model",
    description: "Excel model behind the portfolio results.", // optional
    fileType: "xlsx",            // ppt | pptx | xls | xlsx | pdf | doc | docx | link
    href: "/projects/dfi-bond-portfolio/bond-model.xlsx",
    action: "download",          // open | download | external
    label: "Download model",     // optional button text
  },
  {
    title: "Presentation (Google Slides)",
    fileType: "link",
    href: "https://docs.google.com/…",
    action: "external",
  },
],
```

Safety net: a local file that doesn't exist in `/public` is hidden automatically (and a warning is
printed in the `npm run dev` terminal), so visitors never see a dead link.

Suggested actions: PDF → `open`; PPT/XLS/DOC → `download`; websites → `external`.

**In-site previews.** Each file row has **Preview** (opens inside the site) and **Download original**:

| Format | Preview |
| ------ | ------- |
| PDF | Real pages (PDF.js), page navigation, zoom |
| XLS / XLSX | Read-only workbook: real sheet tabs, grid, cached values (formulas not recalculated, macros never run) |
| DOCX | Converted to readable HTML (headings, lists, tables) |
| PPT / PPTX / DOC | Only with a PDF rendering: run `npm run convert:office` (needs LibreOffice), then add `preview: "/projects/<slug>/previews/<name>.pdf"` to the resource. Otherwise download only. |

---

## 7. Replace the Master Résumé

Save the new PDF as exactly:

```
public/resumes/Pradosh_Kumar_Lenka_Resume_Master.pdf
```

Overwriting the file is enough. The download name visitors get is set in `content/resume.json`.
The "Download résumé" button only appears once this file exists.

---

## 8. Change the look

All visual settings are in **`src/styles/theme.css`** (colours, radii, shadows, easing) and
**`src/app/fonts.ts`** (font families). Components only use these tokens, e.g. `bg-canvas`,
`text-fg-muted`, `border-line`, `rounded-card`, `ease-premium`. Keep text contrast at WCAG AA (4.5:1).

---

## 8b. The 3D cosmic background

One WebGL scene sits behind every page (`src/components/scene/`). It is mounted once in the root
layout, never receives clicks, and only renders while the visitor is scrolling.

| To change…                                    | Edit                                                  |
| --------------------------------------------- | ----------------------------------------------------- |
| Planet positions, sizes, paths, colours, rings | `src/components/scene/sceneConfig.ts` → `planets`     |
| Sky, star, ground and rim colours             | `sceneConfig.ts` → `scenePalette`                     |
| Light direction                               | `sceneConfig.ts` → `sceneLight`                       |
| Phone / low-power detail levels               | `sceneConfig.ts` → `detectQuality()`                  |

Each planet has `keys`: positions at points in the page (`p` = 0 top → 1 bottom). Between keys it
glides smoothly, and scrolling back up plays the same path in reverse. Keep `|x| < 0.55` free so text
stays readable. The rocky horizon belongs to the Hero only and fades out as the Hero scrolls away.

Visitors with "reduce motion" switched on see a still scene; browsers without WebGL get a light CSS sky.

---

## 8c. Admin dashboard (no code needed)

Sign in at `/admin/login` with the admin email (magic link). Then:

- **Site content** — every section's text, lists, links and settings in forms (or JSON), including
  *Design: colours & corners* (with readability checks) and *Animation settings* (sliders with safe
  ranges). Save a **draft** → **Preview drafts** inside the real site (phone / tablet / desktop) →
  **Publish** (optional change note). **History** lists every version; **Restore** brings one back.
  *Download all content* saves a JSON backup.
- **Media** — upload images (JPG, PNG, WebP, AVIF, ≤ 10 MB) and PDFs (≤ 15 MB), edit alt text, replace
  files, see where each is used; files in use cannot be deleted. Pick them in any editor with **Library**.
  Photo location data is removed on upload; **blur certificates before uploading** (no automatic blurring).
- **Work items** — Research & Selected Work cards, covers and attachments.

The JSON files in `content/` remain the fallback: if the database is unreachable the site shows them.
Details: [docs/CONTENT_ARCHITECTURE.md](docs/CONTENT_ARCHITECTURE.md).

---

## 9. Deploy / redeploy (Vercel)

First launch: follow **[docs/LAUNCH.md](docs/LAUNCH.md)** step by step (GitHub, Vercel environment
variables, Supabase sign-in URLs, domain).

Every change after that: run `npm run build` locally to check, then commit and push — Vercel redeploys
automatically.

---

## 10. Asking an AI to edit later

```
EDIT REQUEST
Section: [e.g. Honours / Research / Experience]
Change type: [Add / Update / Remove / Reorder / Hide]
Details: [exact new text, numbers, file names]
Keep everything else exactly as it is.
```

Note: `AGENTS.md` is generated by `next dev` for AI coding tools; leave it in place.
