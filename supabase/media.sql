-- ============================================================================
-- Media library (CMS Phase 3). Apply with: npm run cms:media
--
-- ADDITIVE ONLY: a new PRIVATE bucket "site-media", a new table public.media,
-- their policies and two functions. The existing "work-files" bucket, its
-- policies, and every existing table/policy are untouched.
-- SAFE TO RE-RUN.
--
-- Security model
--   * public.media (file records, alt text): administrator only.
--   * Bucket site-media is PRIVATE: no policy for visitors at all. Only the
--     administrator may upload, replace, list or delete, inside media/<id>/.
--   * Visitors get a file only through the site's /media/<id>/<name> route,
--     and only if that file is referenced by PUBLISHED content
--     (public.media_public, below). Unused / draft-only files stay private.
--   * A file that is used by published content or a draft cannot be deleted
--     (database trigger), and its storage object cannot be deleted while its
--     record exists (storage policy).
-- ============================================================================

create table if not exists public.media (
  id          uuid primary key default gen_random_uuid(),
  path        text not null unique,
  kind        text not null check (kind in ('image', 'pdf')),
  mime        text not null check (mime in ('image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf')),
  bytes       bigint not null check (bytes > 0 and bytes <= 15728640),
  width       integer check (width is null or width between 1 and 20000),
  height      integer check (height is null or height between 1 and 20000),
  title       text not null default '' check (length(title) <= 200),
  alt         text not null default '' check (length(alt) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid,
  constraint media_path_shape check (path ~ '^media/[0-9a-f-]{36}/[A-Za-z0-9._-]+$'),
  constraint media_in_own_folder check (path like 'media/' || id::text || '/%')
);
create index if not exists media_by_time on public.media (created_at desc);

-- updated_at / created_by set by the database.
create or replace function public.media_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' then new.created_by = auth.uid(); else new.created_by = old.created_by; end if;
  return new;
end;
$$;
drop trigger if exists media_touch on public.media;
create trigger media_touch before insert or update on public.media
  for each row execute function public.media_touch();

-- A file still referenced by published content or a draft cannot be deleted.
create or replace function public.media_guard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  needle text := '/media/' || old.id::text || '/';
begin
  if exists (select 1 from public.content_published where strpos(data::text, needle) > 0)
     or exists (select 1 from public.content_drafts where strpos(data::text, needle) > 0) then
    raise exception 'media: file % is still used by the site', old.id using errcode = '23503';
  end if;
  return old;
end;
$$;
drop trigger if exists media_guard_delete on public.media;
create trigger media_guard_delete before delete on public.media
  for each row execute function public.media_guard_delete();

-- For the /media route: path and type of a file, ONLY if published content
-- refers to it. SECURITY DEFINER (visitors cannot read public.media); returns
-- nothing for unused or draft-only files, so it reveals nothing private.
drop function if exists public.media_public(uuid);
create function public.media_public(p_id uuid)
returns table (path text, mime text, bytes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.path, m.mime, m.bytes
  from public.media m
  where m.id = p_id
    and exists (select 1 from public.content_published c where strpos(c.data::text, '/media/' || m.id::text || '/') > 0);
$$;

revoke all on function public.media_touch(), public.media_guard_delete() from public, anon, authenticated;
revoke all on function public.media_public(uuid) from public, anon, authenticated;
grant execute on function public.media_public(uuid) to anon, authenticated;

-- ------------------------------------------------------ table privileges + RLS
revoke all on table public.media from public, anon, authenticated;
grant select, insert, update, delete on table public.media to authenticated;
-- The site's server (secret key, server-only) may look up a file's location — and nothing
-- else — after it has verified a draft-preview token (see src/lib/media/server.ts).
revoke all on table public.media from service_role;
grant select (id, path, mime) on table public.media to service_role;
alter table public.media enable row level security;
drop policy if exists "admin manages media" on public.media;
create policy "admin manages media" on public.media
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------ storage
-- PRIVATE bucket: 15 MB per file; images (no SVG) and PDF only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site-media admin insert" on storage.objects;
drop policy if exists "site-media admin update" on storage.objects;
drop policy if exists "site-media admin delete" on storage.objects;
drop policy if exists "site-media admin select" on storage.objects;
create policy "site-media admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-media' and public.is_admin() and name ~ '^media/[0-9a-f-]{36}/[A-Za-z0-9._-]+$');
create policy "site-media admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'site-media' and public.is_admin())
  with check (bucket_id = 'site-media' and public.is_admin() and name ~ '^media/[0-9a-f-]{36}/[A-Za-z0-9._-]+$');
-- Only files that no media record points to (delete the record first: that is where "in use" is checked).
create policy "site-media admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-media' and public.is_admin() and not exists (select 1 from public.media m where m.path = name));
create policy "site-media admin select" on storage.objects
  for select to authenticated
  using (bucket_id = 'site-media' and public.is_admin());
-- No policy for anon: visitors cannot list, read, upload or delete these files.

-- ============================================================================
-- Part 2 — privacy review before publication (additive, re-runnable).
-- Every new or replaced file starts as 'pending'. Only the administrator can
-- mark it 'approved' (after checking for signatures, IDs, codes, dates of birth).
-- Visitors are served approved files only (media_public), and the site refuses
-- to publish or restore content that uses a file still pending review.
-- ============================================================================
alter table public.media add column if not exists privacy_review text not null default 'pending';
alter table public.media add column if not exists reviewed_at timestamptz;
alter table public.media add column if not exists reviewed_by uuid;
do $$ begin
  alter table public.media add constraint media_privacy_review check (privacy_review in ('pending', 'approved'));
exception when duplicate_object then null; end $$;

create or replace function public.media_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  if tg_op = 'INSERT' then
    new.created_by = auth.uid();
    new.privacy_review = 'pending';           -- never approved on upload
    new.reviewed_at = null;
    new.reviewed_by = null;
    return new;
  end if;
  new.created_by = old.created_by;
  if new.path is distinct from old.path then  -- a replaced file must be reviewed again
    new.privacy_review = 'pending';
  end if;
  if new.privacy_review = 'approved' and old.privacy_review is distinct from 'approved' then
    new.reviewed_at = now();
    new.reviewed_by = auth.uid();
  elsif new.privacy_review = 'pending' then
    new.reviewed_at = null;
    new.reviewed_by = null;
  else
    new.reviewed_at = old.reviewed_at;        -- review stamps cannot be forged
    new.reviewed_by = old.reviewed_by;
  end if;
  return new;
end;
$$;

drop function if exists public.media_public(uuid);
create function public.media_public(p_id uuid)
returns table (path text, mime text, bytes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select m.path, m.mime, m.bytes
  from public.media m
  where m.id = p_id
    and m.privacy_review = 'approved'
    and exists (select 1 from public.content_published c where strpos(c.data::text, '/media/' || m.id::text || '/') > 0);
$$;
revoke all on function public.media_touch() from public, anon, authenticated;
revoke all on function public.media_public(uuid) from public, anon, authenticated;
grant execute on function public.media_public(uuid) to anon, authenticated;
