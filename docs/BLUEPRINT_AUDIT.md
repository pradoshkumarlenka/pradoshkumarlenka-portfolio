# Blueprint compliance audit

Against `Pradosh_Website_Blueprint_for_AI (1).md`. Status: **Done** (implemented and tested),
**Live check** (implemented; needs the deployed site to confirm), **Blocked** (needs your content,
permission or accounts), **Partial**, **Changed by owner** (a deliberate earlier design decision).
Tests: `npm run test:security:all` (security/functional, site running), `npm run test:content`,
`npm run test:site`, plus the visual/performance scripts described in the final report.

## Part A — rules

| Requirement | Where | Status | Verified by |
| --- | --- | --- | --- |
| Only facts from Part B; `[ADD]` when missing | `content/*.json` | Done | Content unchanged by the CMS work (all blocks hash-verified against the files); nothing invented — role-specific résumés are marked as awaiting, not faked |
| Never name a Deloitte client | content | Done | Content review in earlier stages; no client names added |
| Research labelled "ongoing", trading "paper" | `research.json` (`status: ongoing`), `projects/crisis-paper-trading.json` | Done | Content check |
| No company logos as decoration | components | Done | Company names are text |
| Purposeful, restrained motion | `src/lib/animation`, components | Done | Old suites (hero, reveal, trail, proof, bars, intro…) |
| Name and key numbers fast on a phone (< 1.5 s) | `HeroName.tsx`, `globals.css`, 3D deferral | **Partial** | Throttled phone (4× CPU, fast 4G, no cache): name visible 1.76–2.53 s (was 9–13 s), first paint 1.3–1.55 s; the name now follows first paint by ~0.45 s. Under 1.5 s needs first paint itself under ~1 s on such a phone |
| Heavy 3D after first paint | `CosmicBackground.tsx` | Done | Waits for idle time and, on the home page, for the name (≤ 2.5 s) |
| Ask before adding sections not in Part C | — | Done | No new sections added |

## Part C — flow and navigation

| Requirement | Where | Status | Verified by |
| --- | --- | --- | --- |
| Section order 0–10 + footer | `content/sections.json`, `(site)/page.tsx` | Done | Visual comparisons, old suites |
| 0 Intro loader | `IntroLoader.tsx`, `globals.css` | Done | `test:site` (first visit only, click-through, not focusable, gone < 1.8 s, skipped with reduced motion / repeat visits / deep links) |
| Sticky nav with monogram and section links | `Navbar.tsx` | Done | Old suites |
| Theme toggle | — | **Changed by owner** | One permanent dark theme (owner's rule: no light theme, no switcher) |
| Accent reading-progress line | `ReadingProgress.tsx` | Done | Old suites |

## Part D — sections

| Requirement | Status | Notes / verification |
| --- | --- | --- |
| 0 Loader: line draw, PKL fade, 000→100 counter, vault-door split, skip on repeat + reduced motion | Done | `test:site` |
| 1 Hero | Done | Name, brand line, CTAs (View My Work, Download Résumé, Watch introduction) |
| 1 Hero 3D tranche tower | **Changed by owner** | Owner's cosmic planet scene and halftone portrait replace it (earlier design decision) |
| 2 Proof bar: 5 headline numbers | **Partial (content)** | 4 numbers in `proof.json`; a fifth needs a real figure from you |
| 3 Experience: Deloitte, then Metrics4 | Done | `experience.json` |
| 4 Flagship research: Securitization X-Ray (ongoing) | Done | Research page + featured block |
| 5 Selected work (case studies) | Done | 5 case studies + admin-managed items |
| 6 Leadership | Done | |
| 7 Honours: top 12 + archive, certificates, education | Done | 12 honours + 3 in archive; 16 certificates (blurred originals kept private) |
| 8 Beyond the classroom photo strip | Done | Pinned WebGL carousel; now loads on demand |
| 9 Résumé library: 6 role versions, selector, preview, Download PDF, file names | **Partial (content)** | Selector, preview, downloads and naming done and tested (`test:site`); only the **Master** PDF exists — 5 versions show "being prepared". Staged as a draft: publish it in the admin |
| 10 Contact: heading, Email · Phone · LinkedIn rows, copy email + toast, no form | Done | `ContactSection.tsx` |
| Footer text + back to top | Done | |

## Part E — motion, mobile, sound

| Requirement | Status | Notes / verification |
| --- | --- | --- |
| One premium easing; 400–900 ms | Done | `theme.css` token |
| Lenis smooth scroll; GSAP reveals once | Done | Old suites |
| Magnetic primary buttons | Done | `Magnetic.tsx` |
| Page transition line wipe (home ⇄ case studies) | Done | `PageTransition.tsx`; `test:site` (no navigation delay, click-through, focus moves to main, Back works, off with reduced motion) |
| Reduced motion: no 3D motion, loader, count-ups; final states | Done | Reduced-motion screenshots, `test:site`, name shown instantly |
| Mobile: lighter 3D, swipeable proof bar, one-column bento, swipe photo strip, no sideways scroll at 375 px | Done | Old suites + 375 px screenshots |
| No sound | Done | Video plays only on request; compressed 84.5 MB → 9.2 MB (SSIM 0.987), original preserved |

## Part F — technical

| Requirement | Status | Notes / verification |
| --- | --- | --- |
| Next.js + TypeScript + Tailwind + R3F + GSAP + Lenis | Done | |
| All content in one place, editable without touching design | Done (extended) | `content/*.json` + the admin CMS (drafts, preview, history) |
| Certificates/photos as WebP in `/public` | Done | |
| Lighthouse 95+ | **Partial** | Lighthouse 12.6 medians (3 runs, production build): desktop research/case studies **99**, desktop home **69**, mobile home **58–60** (2026-11-23, after per-section hydration; other pages 55–67 earlier); accessibility, best practices, SEO **100** on all audited pages. The home page is limited by the WebGL scenes and hydration under lab CPU throttling |
| SEO: title, description, Open Graph image, Person structured data, sitemap | Done | Plus canonical URLs, Twitter cards, robots.txt; `test:site` |
| Hosting on Vercel + custom domain | **Blocked (your accounts)** | `docs/LAUNCH.md` |
| Privacy-friendly analytics | **Live check** | Vercel Web Analytics wired (public pages only); enable it in Vercel after deploying |

## Admin hardening (owner requirements, 2026-11-23)

| Requirement | Status | Verified by |
| --- | --- | --- |
| Idle (30 min) and absolute (12 h) session limits, server-enforced; logout clears all admin cookies | Done | `tests/security/11-admin-session.mjs` (16 checks) |
| Single-tab admin: refresh keeps access; new / duplicated tabs locked | Done (browser limits documented in BACKEND_SETUP) | same |
| Safe deletion: confirmation, published warning, concurrency check, only the record, media never auto-deleted | Done | `tests/security/12-safe-delete.mjs` |
| Static media cached (1 day + background revalidation) | Done | response headers |

## Parts G–J

| Requirement | Status | Notes |
| --- | --- | --- |
| Blur signatures, remove IDs/codes, no mark sheets, no full Deloitte letter | Done + enforced | Existing assets were processed earlier; new uploads need an explicit privacy approval before they can be shown |
| 6 résumé PDFs | **Blocked (content)** | Only the Master PDF exists |
| Verify links (Credly etc.) | Done | Real links only, in `honours.json` |
| Launch checklist: numbers match, no client names, labels, WCAG AA contrast, reduced motion, downloads work | Done | Contrast enforced by the design editor; downloads tested |
| Launch checklist: average Android phone without lag | **Live check** | Throttled-phone measurements above; test on a real phone after deploying |
| Launch checklist: custom domain, link on LinkedIn/résumés | **Blocked (your accounts)** | |
| Sections switchable, lists grow, status labels editable, assets by folder, comments, README | Done | Plus the admin CMS and media library |
