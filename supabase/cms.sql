-- ============================================================================
-- Site content CMS (Phase 1) — content blocks in the database.
-- Apply with: npm run cms:schema   (runs this file in ONE transaction)
--
-- ADDITIVE ONLY: creates three new tables, two trigger functions and their
-- policies. It does not alter admins, items, attachments, is_admin(), storage
-- or any existing policy.
-- SAFE TO RE-RUN: IF NOT EXISTS / OR REPLACE everywhere, policies and triggers
-- are dropped and recreated, and no row is ever inserted, changed or deleted.
--
-- Security model
--   * content_published  visitors may READ (it is what the public site shows);
--                        only the administrator may write.
--   * content_drafts     administrator only (read and write). Invisible to visitors.
--   * content_versions   append-only history written ONLY by a trigger;
--                        readable by the administrator; nobody can edit/delete it.
--   * "administrator" = public.is_admin() (unchanged, from schema.sql).
--   * Keys are limited to the 14 known blocks; each block is <= 1 MB.
-- ============================================================================

-- --------------------------------------------------------- published blocks
create table if not exists public.content_published (
  key         text primary key,
  data        jsonb not null,
  version     integer not null default 1,
  updated_at  timestamptz not null default now(),
  constraint content_published_key check (key in ('site','sections','hero','proof','experience','research','leadership','honours','beyond','resume','contact','footer','ui','projects')),
  constraint content_published_shape check (jsonb_typeof(data) in ('object','array')),
  constraint content_published_size check (octet_length(data::text) <= 1048576)
);

-- ------------------------------------------------------------ draft blocks
create table if not exists public.content_drafts (
  key         text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid,
  constraint content_drafts_key check (key in ('site','sections','hero','proof','experience','research','leadership','honours','beyond','resume','contact','footer','ui','projects')),
  constraint content_drafts_shape check (jsonb_typeof(data) in ('object','array')),
  constraint content_drafts_size check (octet_length(data::text) <= 1048576)
);

-- --------------------------------------------------------- version history
create table if not exists public.content_versions (
  id          bigint generated always as identity primary key,
  key         text not null,
  version     integer,
  operation   text not null check (operation in ('INSERT','UPDATE','DELETE')),
  data        jsonb,                         -- the block after the change (before it, for DELETE)
  changed_at  timestamptz not null default now(),
  changed_by  uuid                           -- auth.uid() of the admin; null for server scripts
);
create index if not exists content_versions_by_key on public.content_versions (key, id desc);

-- -------------------------------------- guard + version bump (runs as caller)
-- SECURITY INVOKER. Defence in depth on top of RLS: an API caller (anon /
-- authenticated) who is not the administrator is rejected even if a policy
-- were ever misconfigured. Server scripts (postgres) are allowed.
create or replace function public.content_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'content: administrator only' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.updated_at = now();
  if tg_table_name = 'content_published' then
    new.version = case when tg_op = 'UPDATE' then old.version + 1 else 1 end;
  else
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

-- ------------------------------------- history writer (runs as table owner)
-- SECURITY DEFINER so it can append to content_versions, which API roles
-- cannot write. Empty search_path + schema-qualified names: it cannot be
-- hijacked. Postgres only lets trigger functions run AS triggers, so it cannot
-- be called directly to forge history.
create or replace function public.content_record_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.content_versions (key, version, operation, data, changed_by)
    values (old.key, old.version, tg_op, old.data, auth.uid());
    return old;
  end if;
  insert into public.content_versions (key, version, operation, data, changed_by)
  values (new.key, new.version, tg_op, new.data, auth.uid());
  return new;
end;
$$;

-- History is append-only for everyone, including server scripts.
create or replace function public.content_versions_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'content_versions is append-only' using errcode = '42501';
end;
$$;

revoke all on function public.content_before_write(), public.content_record_version(), public.content_versions_immutable() from public, anon, authenticated;

drop trigger if exists content_published_before on public.content_published;
create trigger content_published_before
  before insert or update or delete on public.content_published
  for each row execute function public.content_before_write();
drop trigger if exists content_published_history on public.content_published;
create trigger content_published_history
  after insert or update or delete on public.content_published
  for each row execute function public.content_record_version();

drop trigger if exists content_drafts_before on public.content_drafts;
create trigger content_drafts_before
  before insert or update or delete on public.content_drafts
  for each row execute function public.content_before_write();

drop trigger if exists content_versions_no_change on public.content_versions;
create trigger content_versions_no_change
  before update or delete on public.content_versions
  for each row execute function public.content_versions_immutable();
-- (TRUNCATE is not granted to any API role.)

-- ------------------------------------------------------ table privileges
-- Supabase grants new public tables to the API roles by default; start from
-- nothing and grant only what row-level security then filters.
revoke all on table public.content_published, public.content_drafts, public.content_versions from public, anon, authenticated;
grant select on table public.content_published to authenticated;
-- Visitors: column-level read access (granted in Part 2, once all columns exist).
grant insert, update, delete on table public.content_published to authenticated;
grant select, insert, update, delete on table public.content_drafts to authenticated;
grant select on table public.content_versions to authenticated;

-- ------------------------------------------------------ row-level security
alter table public.content_published enable row level security;
alter table public.content_drafts enable row level security;
alter table public.content_versions enable row level security;

drop policy if exists "read published content" on public.content_published;
drop policy if exists "admin inserts content" on public.content_published;
drop policy if exists "admin updates content" on public.content_published;
drop policy if exists "admin deletes content" on public.content_published;
create policy "read published content" on public.content_published
  for select to anon, authenticated using (true);
create policy "admin inserts content" on public.content_published
  for insert to authenticated with check (public.is_admin());
create policy "admin updates content" on public.content_published
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin deletes content" on public.content_published
  for delete to authenticated using (public.is_admin());

drop policy if exists "admin manages drafts" on public.content_drafts;
create policy "admin manages drafts" on public.content_drafts
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admin reads history" on public.content_versions;
create policy "admin reads history" on public.content_versions
  for select to authenticated using (public.is_admin());

-- ============================================================================
-- Part 2 — integrity metadata, publish and rollback (additive, re-runnable).
-- ============================================================================
-- schema_version: shape version of the JSON (the site only uses version 1).
-- content_hash:   SHA-256 of the stored JSON (jsonb binary form), computed by the database.
-- published_by:   the admin who published (set by the trigger, not the client).
alter table public.content_published add column if not exists schema_version integer not null default 1;
alter table public.content_published add column if not exists published_by uuid;
alter table public.content_published add column if not exists content_hash text generated always as (encode(sha256(jsonb_send(data)), 'hex')) stored;

alter table public.content_drafts add column if not exists schema_version integer not null default 1;
alter table public.content_drafts add column if not exists base_version integer;  -- published version the draft started from
alter table public.content_drafts add column if not exists content_hash text generated always as (encode(sha256(jsonb_send(data)), 'hex')) stored;

alter table public.content_versions add column if not exists schema_version integer not null default 1;
alter table public.content_versions add column if not exists source text not null default 'migration';
alter table public.content_versions add column if not exists note text;
alter table public.content_versions add column if not exists content_hash text generated always as (encode(sha256(jsonb_send(coalesce(data, 'null'::jsonb))), 'hex')) stored;
do $$ begin
  alter table public.content_versions add constraint content_versions_source check (source in ('migration', 'publish', 'rollback', 'script'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.content_versions add constraint content_versions_note check (note is null or length(note) <= 500);
exception when duplicate_object then null; end $$;
-- One history entry per published version of a block (deletions excepted).
create unique index if not exists content_versions_key_version on public.content_versions (key, version) where operation <> 'DELETE';
create index if not exists content_versions_by_time on public.content_versions (changed_at);

-- Guard + version bump: now also stamps published_by.
create or replace function public.content_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'content: administrator only' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  new.updated_at = now();
  if tg_table_name = 'content_published' then
    new.version = case when tg_op = 'UPDATE' then old.version + 1 else 1 end;
    new.published_by = auth.uid();
  else
    new.updated_by = auth.uid();
  end if;
  return new;
end;
$$;

-- History writer: records why the change happened. Source/note come from
-- transaction-local settings set by the functions below; otherwise the entry
-- is recorded as 'script' (server scripts) or 'publish' (admin API).
create or replace function public.content_record_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source text := coalesce(nullif(current_setting('app.content_source', true), ''), case when auth.uid() is null then 'script' else 'publish' end);
  v_note   text := left(nullif(current_setting('app.content_note', true), ''), 500);
begin
  if v_source not in ('migration', 'publish', 'rollback', 'script') then v_source := 'script'; end if;
  if tg_op = 'DELETE' then
    insert into public.content_versions (key, version, operation, data, changed_by, schema_version, source, note)
    values (old.key, old.version, tg_op, old.data, auth.uid(), old.schema_version, v_source, v_note);
    return old;
  end if;
  insert into public.content_versions (key, version, operation, data, changed_by, schema_version, source, note)
  values (new.key, new.version, tg_op, new.data, auth.uid(), new.schema_version, v_source, v_note);
  return new;
end;
$$;

-- Publish the draft of one block: draft → published, history entry, draft
-- removed, in one transaction. SECURITY INVOKER: runs with the caller's rights,
-- so row-level security applies exactly as for direct writes.
-- p_expected_version refuses to overwrite a newer publish (null = first publish).
create or replace function public.content_publish(p_key text, p_expected_version integer, p_note text default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_draft public.content_drafts%rowtype;
  v_version integer;
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'content: administrator only' using errcode = '42501';
  end if;
  select * into v_draft from public.content_drafts where key = p_key for update;
  if not found then raise exception 'content: no draft for %', p_key using errcode = 'P0002'; end if;
  perform set_config('app.content_source', 'publish', true);
  perform set_config('app.content_note', coalesce(left(p_note, 500), ''), true);
  if exists (select 1 from public.content_published where key = p_key) then
    update public.content_published
       set data = v_draft.data, schema_version = v_draft.schema_version
     where key = p_key and version = p_expected_version
     returning version into v_version;
    if v_version is null then raise exception 'content: % was changed elsewhere', p_key using errcode = '40001'; end if;
  else
    insert into public.content_published (key, data, schema_version) values (p_key, v_draft.data, v_draft.schema_version)
    returning version into v_version;
  end if;
  delete from public.content_drafts where key = p_key;
  perform set_config('app.content_source', '', true);
  perform set_config('app.content_note', '', true);
  return v_version;
end;
$$;

-- Restore an earlier published version. It becomes a NEW version; history is never rewritten.
create or replace function public.content_rollback(p_key text, p_to_version integer, p_expected_version integer, p_note text default null)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_data jsonb;
  v_schema integer;
  v_version integer;
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin() then
    raise exception 'content: administrator only' using errcode = '42501';
  end if;
  select data, schema_version into v_data, v_schema from public.content_versions
   where key = p_key and version = p_to_version and operation <> 'DELETE';
  if v_data is null then raise exception 'content: version % of % not found', p_to_version, p_key using errcode = 'P0002'; end if;
  perform set_config('app.content_source', 'rollback', true);
  perform set_config('app.content_note', coalesce(left(p_note, 500), 'Restored version ' || p_to_version), true);
  update public.content_published set data = v_data, schema_version = v_schema
   where key = p_key and version = p_expected_version
   returning version into v_version;
  if v_version is null then raise exception 'content: % was changed elsewhere', p_key using errcode = '40001'; end if;
  perform set_config('app.content_source', '', true);
  perform set_config('app.content_note', '', true);
  return v_version;
end;
$$;

revoke all on function public.content_before_write(), public.content_record_version(), public.content_versions_immutable() from public, anon, authenticated;
revoke all on function public.content_publish(text, integer, text), public.content_rollback(text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.content_publish(text, integer, text), public.content_rollback(text, integer, integer, text) to authenticated;
-- Visitors may read the published content, but not who published it.
revoke select on table public.content_published from anon;
grant select (key, data, version, updated_at, schema_version, content_hash) on table public.content_published to anon;

-- ============================================================================
-- Part 3: two more blocks, "design" (theme tokens) and "animation" (motion
-- settings). Widens the allowed keys only; nothing else changes.
-- ============================================================================
alter table public.content_published drop constraint if exists content_published_key;
alter table public.content_published add constraint content_published_key check (key in ('site','sections','hero','proof','experience','research','leadership','honours','beyond','resume','contact','footer','ui','projects','design','animation'));
alter table public.content_drafts drop constraint if exists content_drafts_key;
alter table public.content_drafts add constraint content_drafts_key check (key in ('site','sections','hero','proof','experience','research','leadership','honours','beyond','resume','contact','footer','ui','projects','design','animation'));

-- ============================================================================
-- Part 4 — history protection against TRUNCATE (row triggers do not fire on it).
-- Protection boundary, stated precisely: content_versions cannot be changed,
-- deleted or truncated by any API role (no privileges + RLS) nor by ordinary SQL
-- from server scripts (these triggers). The database OWNER/superuser can still
-- disable or drop triggers deliberately — that requires the database password,
-- which is never deployed (SUPABASE_DB_URL stays local).
-- ============================================================================
drop trigger if exists content_versions_no_truncate on public.content_versions;
create trigger content_versions_no_truncate
  before truncate on public.content_versions
  for each statement execute function public.content_versions_immutable();
