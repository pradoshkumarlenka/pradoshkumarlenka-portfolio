# Launching the site

Everything below is done by you (accounts, keys and domain are yours). Nothing
here has been done yet. Allow about 45 minutes. Keep `.env.local` private:
never paste keys into chat, code or GitHub.

## 0. Before you start (5 min)

1. **Sign in to the admin once, locally** — this has never been verified end to end:
   `npm run dev` → open `http://localhost:3000/admin/login` **on this computer** → enter
   `pradoshlenka9@gmail.com` → open the email **in the same browser on this computer** and click
   the link. You should land on the dashboard. (Links opened on a phone go to `localhost`, which a
   phone cannot reach — that is expected until step 4 below.)
2. Optional but recommended: compress the 85 MB introduction video
   (`public/videos/pradosh-introduction.mp4`) to under 20 MB. GitHub warns above 50 MB and
   visitors on mobile data will thank you. Ask before deleting the original.

## 1. Put the code on GitHub (10 min)

> Pre-push check done 2026-11-23: no Git history existed yet; the 330 files Git would add contain no
> key, token or database URL from `.env.local`; a clean copy of exactly those files (no `.env.local`,
> no raw folders) passes `npm ci`, `npm run build`, `typecheck` and `lint`. Re-check `git status`
> anyway if files were added since.

1. Create a **private** repository on <https://github.com> (e.g. `pradosh-portfolio`). Do not add a README.
2. In this folder:
   ```
   git init
   git add .
   git status
   ```
   Check the list: it must **not** contain `.env.local`, `backups/`, `certificates-src/`,
   `Pradosh_Portfolio_Assets/` or the other raw folders listed in `.gitignore`.
3. `npm run test:security:all` (site running) now also confirms `.env.local` is ignored by Git.
4. ```
   git commit -m "Portfolio site"
   git branch -M main
   git remote add origin https://github.com/<you>/pradosh-portfolio.git
   git push -u origin main
   ```

## 2. Create the Vercel project (10 min)

1. <https://vercel.com> → **Add New → Project** → import the repository. Framework: Next.js (detected).
2. **Before the first deploy**, open *Environment Variables* and add, for **Production** (and Preview if you use it):

   | Name | Value | Notes |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | from `.env.local` | public |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | from `.env.local` | public (row-level security protects data) |
   | `SUPABASE_SECRET_KEY` | from `.env.local` | **mark as Sensitive**; server-only |
   | `ADMIN_EMAIL` | `pradoshlenka9@gmail.com` | the only address that can sign in |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-project>.vercel.app` for now | change to your domain later |

   **Do not add `SUPABASE_DB_URL`** — it is only for the local setup and test scripts.
3. **Deploy.** Open the `.vercel.app` address: the site should look exactly like local.

## 3. Tell Supabase about the live address (5 min) — required for admin sign-in

Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://<your-project>.vercel.app` (later: your domain)
- **Redirect URLs** — add all of:
  - `https://<your-project>.vercel.app/auth/callback`
  - `https://<your-domain>/auth/callback` (when you have one)
  - `http://localhost:3000/auth/callback` (keeps local sign-in working)

Then sign in at `https://<your-project>.vercel.app/admin/login`. The link now works on your phone too.

## 4. Custom domain (optional, 10 min + DNS time)

Vercel → Project → **Settings → Domains** → add `pradoshlenka.com` (or similar) and follow the DNS
instructions at your registrar. Afterwards update `NEXT_PUBLIC_SITE_URL` (Vercel) and the Site URL /
redirect URL (Supabase) to the domain, and **redeploy**.

## 5. After launch

- **Check:** home page, a case study, résumé download, certificate verify links, `/sitemap.xml`,
  `/robots.txt`, and the link preview (paste the URL into LinkedIn's Post Inspector).
- **Free-plan pause:** Supabase pauses free projects after **1 week of inactivity** (supabase.com/pricing).
  To prevent this, `vercel.json` schedules a **daily Vercel Cron** call to `/healthz` (03:23 UTC ± 59 min,
  the Hobby limit is once a day), which reads published content once with the public visitor key.
  It runs on Vercel, so it keeps working without any commits or visits; GitHub scheduled workflows were
  not used because GitHub disables them after 60 days without repository activity.
  If the project is paused anyway, the site stays up (content falls back to the bundled files), but
  Research & Selected Work shows its outage notice and the admin is unavailable until you press
  **Restore** in Supabase (one click, possible for up to 1 year after pausing; after that only a backup
  download remains). Check the cron under Vercel → Project → Settings → Cron Jobs.
- **Backups:** `npm run cms:backup` (local, needs `SUPABASE_DB_URL`) and, in the admin, *Site content →
  Download all content (JSON backup)*. Do this before big edits.
- **Admin sessions:** use the admin in the tab where you signed in. Other tabs show "Admin locked in
  this tab" (by design). Inactivity of 30 min or 12 h after sign-in signs you out — save drafts often.
- **Editing:** everything is in the admin — *Site content* (text, lists, links, design colours,
  animation settings, with drafts, preview, history and restore), *Media* (images and PDFs) and
  *Work items*. Publishing updates the live site immediately.
- **Every code change:** `npm run build` locally, then commit and push — Vercel redeploys.

## 6. Before or right after launch: items waiting for you

- **Keep the offline fallback equal to published content.** The site falls back to the bundled
  `content/*.json` when the database is slow or down, so after publishing in the admin run
  `npm run cms:pull -- --apply` (copies published content into the files, never drafts) and redeploy.
  Every build prints a warning if they differ.
- **Publish the Résumé Library update.** The six-role selector is staged as a *draft* (only the Master
  PDF exists; the other five are shown as "being prepared"). Admin → Site content → Résumé Library →
  Preview drafts → **Publish**. When a role-specific PDF is ready: upload it in **Media**, approve its
  privacy review, pick it in that role's `file` field, publish.
- **Introduction video — compressed.** 84.5 MB → 9.2 MB (720×1280 H.264 High, AAC 128 kbit/s, fast start;
  SSIM 0.987 vs the original). To redo it from the original, the command used was:
  ```
  ffmpeg -i "Pradosh_Introduction_video/pradosh-introduction.original-84MB.mp4" -c:v libx264 -preset slow -crf 23 \
    -profile:v high -level:v 4.0 -pix_fmt yuv420p -vf "scale=720:-2:flags=lanczos" -c:a aac -b:a 128k -ac 2 \
    -movflags +faststart public/videos/pradosh-introduction.mp4
  ```
  (Done on 2026-11-23: the site now serves a 9.2 MB version at the same address; the 84.5 MB original is kept in `Pradosh_Introduction_video/`.)

## 7. Analytics (Vercel Web Analytics)

The code is in place (`src/components/layout/SiteAnalytics.tsx`); nothing is recorded until you
switch it on: Vercel → Project → **Analytics** → *Enable*, then add the environment variable
`ENABLE_VERCEL_ANALYTICS` = `1` (Production) and **redeploy**. Without the variable the site does not
load the analytics script at all (no failed requests, no console errors).

- **Privacy:** no cookies, no cross-site tracking, aggregate counts only; admin, sign-in, media and
  draft-preview pages are never recorded, and query strings are stripped. No consent banner is
  normally required for this kind of cookieless, aggregate measurement — check your own obligations
  (e.g. India's DPDP Act, GDPR for EU visitors) and mention analytics in a privacy note if you add one.
- **Cost:** included on the free Hobby plan with a monthly event allowance (see Vercel's pricing page
  for the current limit). Custom events (the "Resume download" event) are only recorded on paid plans;
  on Hobby the call does nothing and never affects the download.
- **Verify after enabling:** open the live site in a private window, visit 2–3 pages → Vercel Analytics
  shows the visits within a few minutes; visit `/admin` → it must **not** appear; check the browser's
  Network tab: one request to `/_vercel/insights/...` per page view, no third-party domains.

## 8. Monitoring, health and rollback

- **Health check:** `https://<site>/healthz` → `{"status":"ok","database":"ok"}`. Add it to a free
  uptime monitor (e.g. UptimeRobot, every 5–15 min). `"database":"unreachable"` means Supabase is
  paused or down: the site keeps working from its bundled content; restore the project in Supabase.
  Regular checks also help keep a free Supabase project from pausing (the daily Vercel Cron above does
  this already; an external monitor adds e-mail alerts when the site or database is down).
- **Errors:** Vercel → Project → **Logs** (runtime errors, with the digest shown to visitors' error page).
  No paid error-tracking service is needed for a portfolio.
- **Deployment check:** after each deploy open `/`, one case study, `/healthz`, `/sitemap.xml`, and sign
  in to `/admin`.
- **Rollback (site):** Vercel → Deployments → pick the last good one → **Promote to Production** (instant).
- **Rollback (content):** Admin → Site content → block → **History** → **Restore**.
- **Database backup:** `npm run cms:backup` locally (writes `backups/`, never committed) and Admin →
  *Download all content*. Do both before large edits; keep a copy off this computer.

## 9. Maintenance

- **Dependencies:** every 1–2 months run `npm outdated` and `npm audit --omit=dev`; update one package
  at a time, then `npm run build`, `npm run test:security:all` (site running) and check the site.
- **Media and résumés:** Admin → Media → upload → open the file and check it → tick the privacy
  checklist → **Approve** → choose it with **Library** in the editor → publish. Replacing a file sends it
  back to review.
- **Running costs today:** Vercel Hobby (free), Supabase Free (free; pauses when idle; Pro is about
  US$25/month if you want no pausing and daily backups), domain (yearly registrar fee). Nothing else.
