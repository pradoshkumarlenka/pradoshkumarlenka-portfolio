-- ============================================================================
-- Research & Selected Work — database schema, row-level security and storage
-- policies for Supabase (Postgres). Paste into the Supabase SQL editor and run.
--
-- STATUS: reviewed, NOT yet applied (see docs/BACKEND_SETUP.md, stage 2).
-- SAFE TO RE-RUN: every object is created with IF NOT EXISTS / OR REPLACE, and
-- every policy is dropped and recreated, so running it twice changes nothing.
--
-- Security model
--   * Visitors (anon) can read PUBLISHED items and their attachment records only.
--     Drafts and archived items are invisible to them.
--   * Every write (insert / update / delete) is allowed only for the
--     administrator, enforced by Postgres row-level security — the browser is
--     never trusted.
--   * The administrator = a signed-in, non-anonymous user whose email is in
--     public.admins AND whose email is actually confirmed in auth.users.
--   * Files live in a PRIVATE bucket. Visitors never read it directly; the
--     site's server issues short-lived signed URLs for published items only.
-- ============================================================================

-- ---------------------------------------------------------------- admin list
create table if not exists public.admins (
  email text primary key check (email = lower(email) and position('@' in email) > 1)
);
insert into public.admins (email) values ('pradoshlenka9@gmail.com') on conflict do nothing;
alter table public.admins enable row level security; -- no policies: nobody reads it via the API
revoke all on table public.admins from anon, authenticated;

-- True only for the signed-in administrator:
--   * a real (non-anonymous) session,
--   * whose account email is CONFIRMED in auth.users (not a client-supplied claim),
--   * and whose email is listed in public.admins.
-- SECURITY DEFINER so it can read auth.users / public.admins; search_path is
-- empty and every name is schema-qualified, so it cannot be hijacked.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join public.admins a on a.email = lower(u.email)
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and coalesce(u.is_anonymous, false) = false
      and coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated; -- policies call it; returns only the caller's own yes/no

-- --------------------------------------------------------------------- types
do $$ begin
  create type public.item_state as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.file_kind as enum ('pdf', 'ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx');
exception when duplicate_object then null; end $$;

-- --------------------------------------------------------------------- items
create table if not exists public.items (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 80),
  title         text not null check (length(title) between 1 and 200),
  category      text not null default '' check (length(category) <= 80),
  summary       text not null default '' check (length(summary) <= 600),      -- card text
  description   text not null default '' check (length(description) <= 20000), -- detail-page overview (Markdown)
  highlights    text[] not null default '{}' check (cardinality(highlights) <= 12),
  cover_path    text check (cover_path is null or cover_path ~ '^items/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'),
  cover_alt     text not null default '' check (length(cover_alt) <= 300),
  work_status   text not null default 'Completed' check (length(work_status) <= 40), -- "Completed", "Ongoing" …
  state         public.item_state not null default 'draft',
  sort_order    integer not null default 0,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists items_public_order on public.items (state, sort_order);

-- --------------------------------------------------------------- attachments
create table if not exists public.attachments (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references public.items (id) on delete cascade,
  title         text not null check (length(title) between 1 and 200),
  kind          public.file_kind not null,
  -- Files must sit inside their own item's folder: items/<item uuid>/<file name>
  storage_path  text not null unique check (storage_path ~ '^items/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'),
  preview_path  text check (preview_path is null or preview_path ~ '^items/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'),
  size_bytes    bigint not null check (size_bytes > 0 and size_bytes <= 26214400), -- 25 MB
  label         text check (label is null or length(label) <= 60),               -- optional custom button text
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now(),
  constraint attachment_in_own_folder check (storage_path like 'items/' || item_id::text || '/%')
);
create index if not exists attachments_by_item on public.attachments (item_id, sort_order);

-- ------------------------------------------------- timestamps (server-side)
create or replace function public.items_set_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if new.state = 'published' and (tg_op = 'INSERT' or old.state is distinct from 'published') then
    new.published_at = coalesce(new.published_at, now());
  end if;
  return new;
end;
$$;
drop trigger if exists items_touch on public.items;
drop trigger if exists items_timestamps on public.items;
create trigger items_timestamps
  before insert or update on public.items
  for each row execute function public.items_set_timestamps();

-- --------------------------------------------- table privileges (defence in depth)
-- Row-level security does not cover TRUNCATE / REFERENCES / TRIGGER, so the
-- API roles are given only the privileges that RLS then filters row by row.
revoke all on table public.items, public.attachments from anon, authenticated;
grant select on table public.items, public.attachments to anon;
grant select, insert, update, delete on table public.items, public.attachments to authenticated;

-- ------------------------------------------------------- row-level security
alter table public.items enable row level security;
alter table public.attachments enable row level security;

drop policy if exists "public reads published items" on public.items;
drop policy if exists "admin writes items" on public.items;
drop policy if exists "read published items" on public.items;
drop policy if exists "admin inserts items" on public.items;
drop policy if exists "admin updates items" on public.items;
drop policy if exists "admin deletes items" on public.items;

create policy "read published items" on public.items
  for select to anon, authenticated
  using (state = 'published' or public.is_admin());
create policy "admin inserts items" on public.items
  for insert to authenticated with check (public.is_admin());
create policy "admin updates items" on public.items
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes items" on public.items
  for delete to authenticated using (public.is_admin());

drop policy if exists "public reads attachments of published items" on public.attachments;
drop policy if exists "admin writes attachments" on public.attachments;
drop policy if exists "read attachments of published items" on public.attachments;
drop policy if exists "admin inserts attachments" on public.attachments;
drop policy if exists "admin updates attachments" on public.attachments;
drop policy if exists "admin deletes attachments" on public.attachments;

create policy "read attachments of published items" on public.attachments
  for select to anon, authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.items i where i.id = item_id and i.state = 'published')
  );
create policy "admin inserts attachments" on public.attachments
  for insert to authenticated with check (public.is_admin());
create policy "admin updates attachments" on public.attachments
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes attachments" on public.attachments
  for delete to authenticated using (public.is_admin());

-- ----------------------------------------------------------------- storage
-- Private bucket: 25 MB per file, only the allowed document and image types.
-- ON CONFLICT DO UPDATE so a re-run also re-applies these limits.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'work-files', 'work-files', false, 26214400,
  array[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin uploads files" on storage.objects;
drop policy if exists "admin replaces files" on storage.objects;
drop policy if exists "admin deletes files" on storage.objects;
drop policy if exists "admin lists files" on storage.objects;
drop policy if exists "work-files admin insert" on storage.objects;
drop policy if exists "work-files admin update" on storage.objects;
drop policy if exists "work-files admin delete" on storage.objects;
drop policy if exists "work-files admin select" on storage.objects;

create policy "work-files admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'work-files' and public.is_admin() and name ~ '^items/[0-9a-f-]{36}/[A-Za-z0-9._-]+$');
create policy "work-files admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'work-files' and public.is_admin())
  with check (bucket_id = 'work-files' and public.is_admin() and name ~ '^items/[0-9a-f-]{36}/[A-Za-z0-9._-]+$');
create policy "work-files admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'work-files' and public.is_admin());
create policy "work-files admin select" on storage.objects
  for select to authenticated
  using (bucket_id = 'work-files' and public.is_admin());
-- No policy for anon: visitors cannot list, read, upload or delete bucket files.
-- The site's server (secret key, server-only) creates short-lived signed URLs,
-- and only for covers/attachments of PUBLISHED items.
