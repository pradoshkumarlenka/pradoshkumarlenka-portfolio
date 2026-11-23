# Content architecture

All site content is read through one layer. Published blocks come from the
Supabase database; the bundled `/content/*.json` files are the permanent
fallback (database missing, invalid, slow or unreachable → JSON).

```
content/*.json ──► src/lib/content/registry.ts   (STATIC_CONTENT: typed JSON, the permanent fallback)
                         │
src/lib/content/source.ts  SOURCES = [draftSource (admin preview only), databaseSource, jsonSource]
                         │
src/lib/content/server.ts  getContent(key)  (server-only, React cache: once per request, never throws)
        │                         getSite · getOrderedSections · getSection · getProjects · getCaseStudyProjects
        │
        ├── server components / pages call getContent(...) directly
        └── app/layout.tsx → getClientContent() → <ContentProvider>
                                   │
src/lib/content/client.tsx  useUi · usePerson · useNavItems · useAnimationConfig   (client components)
```

Rules (enforced by ESLint `no-restricted-imports`): only `registry.ts` (and the
generated project index) may import the JSON files. Components use
`getContent` (server) or the hooks (client).

## Content blocks

| Key | File | Feeds |
| --- | --- | --- |
| `site` | content/site.json | Page title, description, metadata |
| `sections` | content/sections.json | Section order/visibility/headings, navigation |
| `hero` | content/hero.json | Hero, intro video, navbar monogram, author |
| `proof` | content/proof.json | Proof Bar |
| `experience` | content/experience.json | Experience timeline |
| `research` | content/research.json | Featured research block, research-note page |
| `leadership` | content/leadership.json | Leadership |
| `honours` | content/honours.json | Honours carousel, certificate wall, education |
| `beyond` | content/beyond.json | Beyond the Classroom |
| `resume` | content/resume.json | Résumé Library, Hero résumé button |
| `contact` | content/contact.json | Contact |
| `footer` | content/footer.json | Footer |
| `ui` | content/ui.json | Shared labels (navigation, buttons, viewers, charts) |
| `design` | content/design.json | Theme colours and corner rounding |
| `animation` | content/animation.json | Motion settings (reveals, scrolling, hero, cursor trail, counters, carousels) |
| `projects` | content/projects/*.json (5) | Project card extras, case-study pages |

Research & Selected Work items (title, summary, status, covers, files) already
come from Supabase (`src/lib/work/public.ts`); the rich case-study sections
still come from the `projects` and `research` blocks.

## Database (CMS Phase 1)

Schema: `supabase/cms.sql` (additive, re-runnable, applied with `npm run cms:schema`).

| Table | Visitors | Admin (`is_admin()`) |
| --- | --- | --- |
| `content_published` | read content columns (not `published_by`) | read / write |
| `content_drafts` | none | read / write |
| `content_versions` | none | read only — written only by a trigger; append-only for everyone |

- Keys are limited to the known blocks; each block ≤ 1 MB, an object (array for `projects`).
- `version`, `updated_at`, `published_by`, `updated_by` and `content_hash` are set by the database, never by the client.
- `content_publish(key, expected_version, note)`: draft → published → history → draft cleared, in one transaction; refuses if someone published in between. `content_rollback(key, to_version, expected_version, note)` restores an old version as a new one. Both run with the caller's rights (RLS applies).
- Trigger functions use an empty `search_path`; only the history writer is SECURITY DEFINER; none can be called through the API.

Reading: `src/lib/content/database-source.ts` — one visitor query per render (publishable key only), `schema_version = 1` only, 2.5 s timeout, every block checked by `src/lib/content/validate.ts` (JSON schema + safe links + local-only file paths + limits).

Scripts:
- `npm run cms:backup` — read-only snapshot into git-ignored `backups/`.
- `npm run cms:schema` — applies `cms.sql`; rolls back if any pre-existing object, row, file or account changed.
- `npm run cms:import` — dry run; `-- --apply` inserts missing blocks and never overwrites.
- `npm run cms:verify` — database equals JSON, schema-valid, history complete.

## Editing (CMS Phase 2)

`/admin/content` lists the blocks; `/admin/content/<key>` edits one with a form generated from its JSON schema (or raw JSON). Save draft → Publish (optional change note) → the site updates immediately (`revalidatePath`). Server actions in `src/lib/admin/content-actions.ts` check `assertAdmin()`, validate everything again and run as the signed-in admin.

Tests: `tests/security/06-content-cms.mjs` (database), `07-content-editor.mjs` (browser; `--publish` adds one real publish of identical content), `tests/content/fallback.mjs` (`npm run test:content`).

## Preview, history, rollback (CMS Phase 4)

- **Preview:** `/admin/preview` (or "Preview drafts" in the editor) turns on Next.js Draft Mode via `POST /admin/preview/enable` (admin-checked, same-origin only, no open redirects) and shows the real site in an iframe at phone / tablet / desktop widths. `src/lib/content/draft-source.ts` serves drafts only when Draft Mode is on **and** the request has a valid admin session; everyone else gets published content, and static pages stay static. A banner with "Exit preview" is shown only to the admin.
- **History:** `/admin/content/<key>/history` lists every version (source, note, date, fingerprint, changed fields). "Restore" republishes an old version as a new one after re-validating it.

## Design and animation settings (CMS Phases 5–6)

- `design` block (`content/design.json`): accent, text, surface and chart colours, plus corner rounding → the CSS variables in `src/styles/theme.css`. Only values that differ from the defaults are emitted (`<style id="theme-overrides">`), as validated hex/px. Text colours must keep WCAG contrast (4.5:1 text, 3:1 accents). The page background is the cosmic scene and is not part of this block. Fonts are fixed: they are bundled at build time.
- `animation` block (`content/animation.json`): every setting the components read today. Ranges come from `ANIMATION_LIMITS` (the editor shows sliders; saving and reading both enforce them); `applyAnimationSettings()` merges over the defaults and clamps. Values still set inside components (`documented` group) are not editable. Reduced-motion preferences always win.

## Hardening (CMS Phase 8)

- Security headers on every response (`next.config.ts`): `frame-ancestors 'self'` + `X-Frame-Options`, `nosniff`, referrer policy, permissions policy; no `X-Powered-By`.
- `/admin/content/export`: admin-only JSON download of all published blocks and drafts.
- Saving a draft warns about referenced `/public` files that the site does not serve.
- Tests: `tests/security/01`–`09` (`npm run test:security:all`, site running), `npm run test:content`.

## Animation configuration

`src/lib/animation/config.ts` — typed `AnimationConfig`, `ANIMATION_DEFAULTS`
(exactly today's values) and `ANIMATION_LIMITS` (safe ranges for future editors).
`getAnimationConfig()` (server) / `useAnimationConfig()` (client) provide it.

Read from config today: reveal defaults and the section preset, smooth-scroll
lerp, hero name intro, halftone portrait start delay, cursor trail (all
settings), Proof Bar roll speed, Honours carousel, certificate filter fade,
Beyond carousel (scroll per photo, stage height, lens settings).
Documented only (still set in their components): Experience timeline, Proof Bar
entrance, chart grow timings, halftone/TechText internals, hover lift, planets.
Reduced-motion preferences always override these settings.

## Media privacy review, history boundary (final hardening)

- Every library file starts as **review pending** (database trigger; it cannot be inserted as approved and
  review stamps cannot be forged). Only the admin can approve, after ticking the privacy checklist.
  Visitors are served approved files only (`media_public`), and publishing/restoring content that uses an
  unapproved file is refused. Replacing a file resets it to pending. Nothing is redacted automatically.
- `content_versions` (history): no API role can change, delete or truncate it (no privileges + RLS), and
  ordinary SQL — including server scripts using the owner role — is blocked by triggers (UPDATE, DELETE and
  TRUNCATE). The database owner/superuser could still deliberately disable or drop those triggers; that
  requires the database password, which is only in the local `.env.local` and never deployed.
- Résumé variants: `resume.variants` (optional) drives the role selector; `file: null` = awaiting a real PDF.
