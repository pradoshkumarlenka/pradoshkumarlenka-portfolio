# Research & Selected Work — backend, admin and deployment

## Where things stand

| Stage | What | Status |
| --- | --- | --- |
| 1 | Public design: heading, subtitle, six items, “Explore Work →”, detail pages, file-specific attachment buttons, hidden empty panels | **Built and tested** |
| 2 | Database + storage (Supabase): `supabase/schema.sql` (+ `cms.sql`, `media.sql` for the CMS) | **Applied and tested** |
| 3 | Admin login (magic link to `pradoshlenka9@gmail.com` only) + server-side checks | **Built and tested with test sessions; your real email sign-in still to be done once (docs/LAUNCH.md step 0)** |
| 4 | Admin dashboard (work items, site content CMS, media library) | **Built and tested** |
| 5 | Security tests (`tests/security/01–10`) | **Built; all passing** |
| 6 | Deploy to Vercel, sitemap, metadata, backups | **Sitemap, robots, social image, structured data and backups done; deployment not done — see docs/LAUNCH.md** |

## What I need from you (about 10 minutes)

### 1. Create the Supabase project (free)
1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub or email.
2. **New project** → name `pradosh-portfolio`, choose region **Mumbai (ap-south-1)**, set a strong database password and save it in a password manager.
3. Wait ~2 minutes for it to start.
4. Open **Project Settings → API** and copy:
   - **Project URL**
   - **Publishable key** (`sb_publishable_…`)
   - **Secret key** (`sb_secret_…` — never share it, never commit it)

### 2. Put the keys in a local file (never in chat, never in code)
Create `.env.local` in the project folder:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co      # base address only, no /rest/v1/
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
ADMIN_EMAIL=pradoshlenka9@gmail.com
```

`.env.local` is already excluded from git. Tell me when it exists — I will read it locally to run the setup, and will never print the keys.

### 3. Create GitHub + Vercel accounts (for deployment, stage 6)
1. <https://github.com> — free account (Vercel deploys from a GitHub repository).
2. <https://vercel.com> — **Sign up with GitHub**.
No domain is needed: the site will live at `https://<name>.vercel.app` with HTTPS included. A custom domain can be added later in Vercel → Domains.

## Environment variables

| Name | Where | Secret? | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | local + Vercel | no | Supabase project address |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | local + Vercel | no (RLS protects data) | visitor-level access; safe in the browser |
| `SUPABASE_SECRET_KEY` | **server only** (local + Vercel) | **yes** | signed file URLs, admin uploads; bypasses RLS, so it is only ever imported from server-only modules |
| `ADMIN_EMAIL` | local + Vercel | no | the only email allowed to sign in |

Development and production use **separate Supabase projects** (create a second one, e.g. `pradosh-portfolio-dev`, when we reach stage 6), each with its own keys.

## Security design (summary)
- **Authentication:** Supabase Auth email magic link; public sign-ups **disabled** (verified); only `ADMIN_EMAIL` can receive a link. Account recovery = a new magic link to the same inbox (protect that Gmail with 2-step verification).
- **Authorization:** enforced in Postgres row-level security (`public.is_admin()`) *and* in every server action — the browser is never trusted.
- **Session limits:** signed out after **30 min without activity** (warning 2 min before) and **12 h after the email sign-in**, enforced on the server (`src/lib/admin/session-policy.ts`, `src/proxy.ts`); the expired session is revoked in Supabase.
- **One tab:** admin access belongs to the tab that completed the sign-in (refresh keeps it). New tabs/windows and duplicated tabs are locked; signing in again moves access to the new tab. Limits: the page's data reaches the browser before the tab check, so someone at your unlocked computer could still read it with developer tools, and the server actions themselves are protected by the session (not the tab). Sign out when you leave.
- **Deletion:** work items need the typed slug (+ an acknowledgement if published) and are only deleted if unchanged since you opened them; uploaded files are kept (private) until *Clean up unused files*. Removing CMS list entries asks first and only changes the draft.
- **Files:** private bucket; type and size checked by Supabase *and* by the server (content sniffing, 25 MB cap); visitors get short-lived signed URLs for published items only.
- **Never upload** employer-restricted or confidential material (e.g. Deloitte client work).

## Backups
Free tier: daily backups kept 7 days are **not** included — so stage 6 adds a one-command export (`npm run backup`) of the tables and files to a dated folder, plus restore steps. Paid tier (Pro) adds automatic daily backups.

## Security tests
Saved in `tests/security/` (Node scripts, never part of the website). They read `.env.local` and never print secrets.

| Command | What it checks | Needs |
| --- | --- | --- |
| `npm run test:security` | Database structure, row-level security, roles, visitor API & private storage | `.env.local` incl. `SUPABASE_DB_URL` |
| `npm run test:security:app` | Admin dashboard access control, forged requests, uploads; public listing, detail pages, attachments | the site running (`npm run dev`, or `SITE=https://… npm run test:security:app`) |
| `npm run test:security:all` | All of the above + secrets absent from the browser build and Git | also `npm run build` first |

Safety: tests create only items whose slug starts with `zztest-` and accounts `zztest-…@test.invalid`. Cleanup deletes only those items, only files under their own `items/<id>/` folders, and only those accounts — real items, covers and attachments are never touched. Database role tests run inside a transaction that is rolled back.

The admin-dashboard test signs in with a test-only session created through Supabase's admin API (no email is sent). The website itself only accepts the real email sign-in.
