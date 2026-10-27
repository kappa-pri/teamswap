-- =====================================================================
-- TeamSwap schema · VERSION 2026-10-16e (item names in notification titles)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to re-run: tables use IF NOT EXISTS, policies/functions are replaced.
-- If the editor already shows an older version, delete it all first.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------

-- Public profile: visible to every signed-in user (team name + role badge).
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  team_name   text not null check (char_length(team_name) between 1 and 60),
  role        text not null check (role in ('school', 'student', 'mentor', 'independent')),
  created_at  timestamptz not null default now()
);

-- Private contact info: only ever readable by its owner. It is shared with
-- the other party only through request_contacts, after an approval.
create table if not exists public.contacts (
  id     uuid primary key references auth.users (id) on delete cascade,
  phone  text not null default '',
  email  text not null default ''
);

create table if not exists public.items (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name           text not null check (char_length(name) between 1 and 80),
  photo_url      text,   -- square crop: thumbnails and item screens
  photo_full_url text,   -- uncropped copy: full-screen feed
  category       text not null default 'Other',
  specialty      text not null default 'general'
                   check (specialty in ('robotics', 'drone', 'roboboat', 'general')),
  condition      text not null default 'good'
                   check (condition in ('new', 'good', 'fair', 'parts_only')),
  notes          text not null default '',
  qty_total      int not null check (qty_total >= 0),
  qty_in_use     int not null default 0 check (qty_in_use >= 0),
  qty_available  int not null default 0 check (qty_available >= 0),
  qty_pending    int not null default 0 check (qty_pending >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint items_qty_sum check (qty_in_use + qty_available + qty_pending = qty_total)
);
create index if not exists items_owner_idx on public.items (owner_id);
-- Upgrade path: uncropped photo for the full-screen feed.
alter table public.items add column if not exists photo_full_url text;
create index if not exists items_available_idx on public.items (qty_available) where qty_available > 0;

create table if not exists public.requests (
  id                        uuid primary key default gen_random_uuid(),
  item_id                   uuid not null references public.items (id) on delete cascade,
  item_name                 text not null,
  owner_id                  uuid not null references public.profiles (id) on delete cascade,
  requester_id              uuid not null references public.profiles (id) on delete cascade,
  qty                       int not null check (qty > 0),
  purpose                   text not null default '',
  available_days            int[] not null default '{}',   -- 0 = Sun … 6 = Sat
  -- Per-day time window, keyed by day number as text:
  --   {"1": {"all_day": true}, "3": {"all_day": false, "start": "15:00", "end": "18:00"}}
  available_windows         jsonb not null default '{}'::jsonb,
  need_by                   date not null,
  requester_suggested_date  date,
  owner_suggested_date      date,
  final_date                date,
  dropoff_start             text,   -- owner drop-off window on final_date, "HH:MM"
  dropoff_end               text,
  status                    text not null default 'pending'
                              check (status in ('pending', 'approved', 'denied', 'received')),
  created_at                timestamptz not null default now(),
  decided_at                timestamptz,
  received_at               timestamptz,
  sent_at                   timestamptz   -- owner tapped "Mark as sent"
);
create index if not exists requests_owner_idx on public.requests (owner_id, status);
create index if not exists requests_requester_idx on public.requests (requester_id, status);
create index if not exists requests_item_idx on public.requests (item_id);

-- Upgrade path for projects created before time windows existed.
alter table public.requests add column if not exists available_windows jsonb not null default '{}'::jsonb;
alter table public.requests add column if not exists dropoff_start text;
alter table public.requests add column if not exists dropoff_end text;
alter table public.requests add column if not exists sent_at timestamptz;

-- Contact info exchanged for a request. Readable only after approval.
create table if not exists public.request_contacts (
  request_id       uuid primary key references public.requests (id) on delete cascade,
  requester_phone  text not null default '',
  requester_email  text not null default '',
  owner_phone      text not null default '',
  owner_email      text not null default ''
);

-- ---------------------------------------------------------------------
-- New-user trigger: builds profile + contacts from sign-up metadata
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', 'independent');
begin
  if v_role not in ('school', 'student', 'mentor', 'independent') then
    v_role := 'independent';
  end if;

  insert into public.profiles (id, team_name, role)
  values (
    new.id,
    left(coalesce(nullif(trim(new.raw_user_meta_data ->> 'team_name'), ''), 'New Team'), 60),
    v_role
  )
  on conflict (id) do nothing;

  insert into public.contacts (id, phone, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'phone', ''), coalesce(new.email, ''))
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Item guard: qty_pending (and ownership) is system-managed only.
-- Client writes run as role "authenticated"; the request functions below
-- are SECURITY DEFINER, so they run as the table owner and may change it.
-- ---------------------------------------------------------------------
create or replace function public.items_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.qty_pending := 0;
      new.owner_id := auth.uid();
    elsif tg_op = 'UPDATE' then
      new.qty_pending := old.qty_pending;
      new.owner_id := old.owner_id;
    elsif tg_op = 'DELETE' then
      if old.qty_pending > 0 then
        raise exception 'This item has open requests. Resolve them before deleting it.';
      end if;
      return old;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists items_guard_trg on public.items;
create trigger items_guard_trg
  before insert or update or delete on public.items
  for each row execute function public.items_guard();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.contacts         enable row level security;
alter table public.items            enable row level security;
alter table public.requests         enable row level security;
alter table public.request_contacts enable row level security;

-- profiles
drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles
  for select to authenticated using (true);
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- contacts (self only)
drop policy if exists "users read own contacts" on public.contacts;
create policy "users read own contacts" on public.contacts
  for select to authenticated using (id = auth.uid());
drop policy if exists "users update own contacts" on public.contacts;
create policy "users update own contacts" on public.contacts
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- items
drop policy if exists "items readable by signed-in users" on public.items;
create policy "items readable by signed-in users" on public.items
  for select to authenticated using (true);
drop policy if exists "owners insert items" on public.items;
create policy "owners insert items" on public.items
  for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists "owners update items" on public.items;
create policy "owners update items" on public.items
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owners delete items" on public.items;
create policy "owners delete items" on public.items
  for delete to authenticated using (owner_id = auth.uid());

-- requests: both parties can read; all writes go through the functions below
drop policy if exists "parties read requests" on public.requests;
create policy "parties read requests" on public.requests
  for select to authenticated using (auth.uid() in (owner_id, requester_id));

-- request_contacts: readable only once approved, only by the two parties
drop policy if exists "parties read contacts after approval" on public.request_contacts;
create policy "parties read contacts after approval" on public.request_contacts
  for select to authenticated using (
    exists (
      select 1 from public.requests r
      where r.id = request_id
        and r.status in ('approved', 'received')
        and auth.uid() in (r.owner_id, r.requester_id)
    )
  );

-- Explicit grants (RLS above still applies)
grant select, update                 on public.profiles         to authenticated;
grant select, update                 on public.contacts         to authenticated;
grant select, insert, update, delete on public.items            to authenticated;
grant select                         on public.requests         to authenticated;
grant select                         on public.request_contacts to authenticated;
revoke all on public.profiles, public.contacts, public.items,
              public.requests, public.request_contacts from anon;

-- ---------------------------------------------------------------------
-- Request lifecycle functions (SECURITY DEFINER, row-locked)
--
--   submit   : available -> pending
--   approve  : stays in pending (reserved for this exchange)
--   deny     : pending   -> available
--   received : removed from pending and total
-- ---------------------------------------------------------------------

-- The signature gained p_available_windows; drop the old 8-argument version.
drop function if exists public.submit_request(uuid, int, text, int[], date, date, text, text);

create or replace function public.submit_request(
  p_item_id         uuid,
  p_qty             int,
  p_purpose         text,
  p_available_days  int[],
  p_need_by         date,
  p_suggested_date  date,
  p_phone              text,
  p_email              text,
  p_available_windows  jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_item public.items%rowtype;
  v_id   uuid;
  v_key  text;
  v_win  jsonb;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;

  -- Validate time windows: one per selected day, either all-day or start < end (HH:MM).
  p_available_windows := coalesce(p_available_windows, '{}'::jsonb);
  if jsonb_typeof(p_available_windows) <> 'object' then
    raise exception 'Invalid availability times';
  end if;
  for v_key, v_win in select * from jsonb_each(p_available_windows) loop
    if v_key !~ '^[0-6]$' then
      raise exception 'Invalid availability times';
    end if;
    if not (v_key::int = any (coalesce(p_available_days, '{}'))) then
      raise exception 'Times were set for a day you did not select';
    end if;
    if jsonb_typeof(v_win) <> 'object' then
      raise exception 'Invalid availability times';
    end if;
    continue when v_win -> 'all_day' = 'true'::jsonb;
    if coalesce(v_win ->> 'start', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or coalesce(v_win ->> 'end', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or (v_win ->> 'start') >= (v_win ->> 'end') then
      raise exception 'Each time window needs a start time before its end time';
    end if;
  end loop;

  select * into v_item from public.items where id = p_item_id for update;
  if not found then raise exception 'Item not found'; end if;
  if v_item.owner_id = v_uid then raise exception 'You cannot request your own item'; end if;
  if p_qty is null or p_qty < 1 then raise exception 'Quantity must be at least 1'; end if;
  if p_qty > v_item.qty_available then
    raise exception 'Only % available right now', v_item.qty_available;
  end if;
  if p_need_by is null or p_need_by < current_date then
    raise exception 'Need-by date must be today or later';
  end if;
  if coalesce(trim(p_phone), '') = '' and coalesce(trim(p_email), '') = '' then
    raise exception 'Add a phone number or email to share if approved';
  end if;

  update public.items
     set qty_available = qty_available - p_qty,
         qty_pending   = qty_pending + p_qty
   where id = p_item_id;

  insert into public.requests (
    item_id, item_name, owner_id, requester_id, qty, purpose,
    available_days, available_windows, need_by, requester_suggested_date
  ) values (
    p_item_id, v_item.name, v_item.owner_id, v_uid, p_qty, coalesce(p_purpose, ''),
    coalesce(p_available_days, '{}'), p_available_windows, p_need_by, p_suggested_date
  )
  returning id into v_id;

  insert into public.request_contacts (request_id, requester_phone, requester_email)
  values (v_id, coalesce(trim(p_phone), ''), coalesce(trim(p_email), ''));

  return v_id;
end;
$$;

create or replace function public.decide_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.requests%rowtype;
begin
  select * into v_req from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.owner_id <> v_uid then raise exception 'Only the owner can decide this request'; end if;
  if v_req.status <> 'pending' then raise exception 'This request was already %', v_req.status; end if;

  perform 1 from public.items where id = v_req.item_id for update;

  if p_approve then
    -- Units stay in pending (reserved) until marked received.
    update public.requests set status = 'approved', decided_at = now() where id = p_request_id;
    update public.request_contacts rc
       set owner_phone = c.phone, owner_email = c.email
      from public.contacts c
     where rc.request_id = p_request_id and c.id = v_uid;
    -- Clear bookmarks this approval makes pointless (defined in the Stage 2 section).
    perform public.prune_saved_items(v_req.item_id, v_req.requester_id);
  else
    update public.items
       set qty_pending   = qty_pending - v_req.qty,
           qty_available = qty_available + v_req.qty
     where id = v_req.item_id;
    update public.requests set status = 'denied', decided_at = now() where id = p_request_id;
  end if;
end;
$$;

create or replace function public.suggest_pickup_date(p_request_id uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.requests%rowtype;
begin
  select * into v_req from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_req.status <> 'approved' then raise exception 'Dates can only be suggested on an approved request'; end if;

  if v_uid = v_req.owner_id then
    update public.requests set owner_suggested_date = p_date where id = p_request_id;
  elsif v_uid = v_req.requester_id then
    update public.requests set requester_suggested_date = p_date where id = p_request_id;
  else
    raise exception 'Not part of this exchange';
  end if;
end;
$$;

-- The signature gained the drop-off window; drop the old 2-argument version.
drop function if exists public.confirm_final_date(uuid, date);

-- Owner: sets the final date AND a drop-off window (both required).
-- Requester: sets the final date only; if the date changes, the old drop-off
-- window is cleared so the owner can pick one for the new day.
create or replace function public.confirm_final_date(
  p_request_id     uuid,
  p_date           date,
  p_dropoff_start  text default null,
  p_dropoff_end    text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.requests%rowtype;
begin
  select * into v_req from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_uid not in (v_req.owner_id, v_req.requester_id) then raise exception 'Not part of this exchange'; end if;
  if v_req.status <> 'approved' then raise exception 'Only approved requests can be scheduled'; end if;
  if p_date is null then raise exception 'Pick a date first'; end if;

  if v_uid = v_req.owner_id then
    if coalesce(p_dropoff_start, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or coalesce(p_dropoff_end, '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
       or p_dropoff_start >= p_dropoff_end then
      raise exception 'Choose a drop-off window with a start time before its end time';
    end if;
    update public.requests
       set final_date = p_date, dropoff_start = p_dropoff_start, dropoff_end = p_dropoff_end
     where id = p_request_id;
  else
    update public.requests
       set final_date    = p_date,
           dropoff_start = case when final_date is distinct from p_date then null else dropoff_start end,
           dropoff_end   = case when final_date is distinct from p_date then null else dropoff_end end
     where id = p_request_id;
  end if;
end;
$$;

create or replace function public.mark_received(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.requests%rowtype;
begin
  select * into v_req from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_uid <> v_req.requester_id then raise exception 'Only the person receiving the item can mark it received'; end if;
  if v_req.status <> 'approved' then raise exception 'Only approved requests can be marked received'; end if;

  update public.items
     set qty_pending = qty_pending - v_req.qty,
         qty_total   = qty_total - v_req.qty
   where id = v_req.item_id;

  update public.requests set status = 'received', received_at = now() where id = p_request_id;
end;
$$;

-- Owner (giver) marks the item as sent / handed off. Purely informational:
-- nothing leaves inventory until the requester marks it received.
create or replace function public.mark_sent(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_req public.requests%rowtype;
begin
  select * into v_req from public.requests where id = p_request_id for update;
  if not found then raise exception 'Request not found'; end if;
  if v_uid <> v_req.owner_id then raise exception 'Only the owner can mark this as sent'; end if;
  if v_req.status <> 'approved' then raise exception 'Only approved requests can be marked sent'; end if;
  if v_req.sent_at is not null then return; end if;

  update public.requests set sent_at = now() where id = p_request_id;
end;
$$;

revoke execute on function public.submit_request(uuid, int, text, int[], date, date, text, text, jsonb) from public, anon;
revoke execute on function public.decide_request(uuid, boolean)                                  from public, anon;
revoke execute on function public.suggest_pickup_date(uuid, date)                                from public, anon;
revoke execute on function public.confirm_final_date(uuid, date, text, text)                     from public, anon;
revoke execute on function public.mark_received(uuid)                                            from public, anon;
revoke execute on function public.mark_sent(uuid)                                                from public, anon;
grant  execute on function public.submit_request(uuid, int, text, int[], date, date, text, text, jsonb) to authenticated;
grant  execute on function public.decide_request(uuid, boolean)                                  to authenticated;
grant  execute on function public.suggest_pickup_date(uuid, date)                                to authenticated;
grant  execute on function public.confirm_final_date(uuid, date, text, text)                     to authenticated;
grant  execute on function public.mark_received(uuid)                                            to authenticated;
grant  execute on function public.mark_sent(uuid)                                                to authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Storage: public bucket for item photos.
-- Files live at  <user-id>/<random>.jpg  and only that user can write there.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('item-photos', 'item-photos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "item photos readable" on storage.objects;
create policy "item photos readable" on storage.objects
  for select to authenticated using (bucket_id = 'item-photos');

drop policy if exists "users upload own item photos" on storage.objects;
create policy "users upload own item photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users update own item photos" on storage.objects;
create policy "users update own item photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete own item photos" on storage.objects;
create policy "users delete own item photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- STAGE 2 · Part A — Saved items (bookmarks of community items)
-- Separate from the wishlist: no deadline or matching logic.
-- Rows are read via RLS (own rows only); writes go through the functions below.
-- =====================================================================
create table if not exists public.saved_items (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  item_id     uuid not null references public.items (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);
create index if not exists saved_items_item_idx on public.saved_items (item_id);

alter table public.saved_items enable row level security;

drop policy if exists "users read own saved items" on public.saved_items;
create policy "users read own saved items" on public.saved_items
  for select to authenticated using (user_id = auth.uid());

grant select on public.saved_items to authenticated;
revoke all on public.saved_items from anon;

create or replace function public.save_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_owner uuid;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  select owner_id into v_owner from public.items where id = p_item_id;
  if not found then raise exception 'Item not found'; end if;
  if v_owner = v_uid then raise exception 'You cannot save your own item'; end if;

  insert into public.saved_items (user_id, item_id)
  values (v_uid, p_item_id)
  on conflict (user_id, item_id) do nothing;
end;
$$;

create or replace function public.unsave_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from public.saved_items where user_id = auth.uid() and item_id = p_item_id;
end;
$$;

revoke execute on function public.save_item(uuid)   from public, anon;
revoke execute on function public.unsave_item(uuid) from public, anon;
grant  execute on function public.save_item(uuid)   to authenticated;
grant  execute on function public.unsave_item(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Saved-item cleanup. Called by decide_request when an owner approves:
--   1. the approved requester's own bookmark for that item is removed;
--   2. if approvals have taken every unit (none available and no request
--      still awaiting a decision, so a denial can't put any back), the item
--      is removed from everyone's Saved Items.
-- Internal only: not callable from the app.
-- ---------------------------------------------------------------------
create or replace function public.prune_saved_items(p_item_id uuid, p_requester uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.saved_items where item_id = p_item_id and user_id = p_requester;

  if exists (select 1 from public.items where id = p_item_id and qty_available = 0)
     and not exists (select 1 from public.requests where item_id = p_item_id and status = 'pending') then
    delete from public.saved_items where item_id = p_item_id;
  end if;
end;
$$;

revoke execute on function public.prune_saved_items(uuid, uuid) from public, anon, authenticated;

-- One-time tidy-up for bookmarks made before this rule existed (safe to re-run).
delete from public.saved_items s
 using public.requests r
 where r.item_id = s.item_id
   and r.requester_id = s.user_id
   and r.status in ('approved', 'received');

delete from public.saved_items s
 using public.items i
 where i.id = s.item_id
   and i.qty_available = 0
   and exists (select 1 from public.requests r where r.item_id = i.id and r.status in ('approved', 'received'))
   and not exists (select 1 from public.requests r where r.item_id = i.id and r.status = 'pending');

-- =====================================================================
-- STAGE 2 · Part B — Wishlist
-- Own rows are read/written directly under RLS. Anything that looks at
-- other teams' items (match counts, match lists) runs in SECURITY DEFINER
-- functions. Entries are deleted once their need-by date has passed.
-- =====================================================================
create table if not exists public.wishlist_entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 80),
  specialty   text not null default 'general'
                check (specialty in ('robotics', 'drone', 'roboboat', 'general')),
  qty_needed  int  not null default 1 check (qty_needed between 1 and 9999),
  need_by     date not null,
  urgent      boolean not null default false,
  notes       text not null default '' check (char_length(notes) <= 1000),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists wishlist_user_idx on public.wishlist_entries (user_id, need_by);
create index if not exists wishlist_need_by_idx on public.wishlist_entries (need_by);

create or replace function public.wishlist_guard()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.user_id := auth.uid();
    else
      new.user_id := old.user_id;
    end if;
  end if;
  new.name := trim(new.name);
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists wishlist_guard_trg on public.wishlist_entries;
create trigger wishlist_guard_trg
  before insert or update on public.wishlist_entries
  for each row execute function public.wishlist_guard();

alter table public.wishlist_entries enable row level security;

drop policy if exists "users read own wishlist" on public.wishlist_entries;
create policy "users read own wishlist" on public.wishlist_entries
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "users add to own wishlist" on public.wishlist_entries;
create policy "users add to own wishlist" on public.wishlist_entries
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "users edit own wishlist" on public.wishlist_entries;
create policy "users edit own wishlist" on public.wishlist_entries
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "users delete own wishlist" on public.wishlist_entries;
create policy "users delete own wishlist" on public.wishlist_entries
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.wishlist_entries to authenticated;
revoke all on public.wishlist_entries from anon;

-- ---------------------------------------------------------------------
-- Matching rules
--   name:      every word of the wishlist name (2+ letters, or any number)
--              appears in the item name, ignoring case and a plural "s".
--              "NEO motors" matches "REV NEO Brushless Motor".
--   item:      another team's item with available > 0.
--   Tag (specialty), condition and quantity are NOT part of matching.
-- ---------------------------------------------------------------------
create or replace function public.wish_name_matches(p_wish text, p_item text)
returns boolean
language sql
immutable
as $$
  with words as (
    select case when length(w) > 3 then regexp_replace(w, 's$', '') else w end as w
    from regexp_split_to_table(lower(coalesce(p_wish, '')), '[^a-z0-9]+') as w
    where w ~ '^[0-9]+$' or length(w) >= 2
  )
  select exists (select 1 from words)
     and not exists (select 1 from words where position(w in lower(coalesce(p_item, ''))) = 0);
$$;

-- Matching used to require the same tag; it's name-only now.
drop function if exists public.wish_specialty_matches(text, text);

-- My wishlist with live match counts. p_today is the phone's local date, so
-- "past its need-by date" follows the user's own calendar; it is clamped to
-- within a day of the server date. Expired entries are deleted here, so they
-- vanish the moment the list is opened.
create or replace function public.get_my_wishlist(p_today date default null)
returns table (
  id uuid,
  name text,
  specialty text,
  qty_needed int,
  need_by date,
  urgent boolean,
  notes text,
  created_at timestamptz,
  match_count int
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_today date := least(greatest(coalesce(p_today, current_date), current_date - 1), current_date + 1);
begin
  if v_uid is null then raise exception 'Not signed in'; end if;

  delete from public.wishlist_entries w where w.user_id = v_uid and w.need_by < v_today;

  return query
    select w.id, w.name, w.specialty, w.qty_needed, w.need_by, w.urgent, w.notes, w.created_at,
           (select count(*)::int
              from public.items i
             where i.owner_id <> v_uid
               and i.qty_available > 0
               and public.wish_name_matches(w.name, i.name)) as match_count
      from public.wishlist_entries w
     where w.user_id = v_uid
     order by w.urgent desc, w.need_by asc, w.created_at desc;
end;
$$;

-- The community items matching one of my entries (ids only; the app loads them).
create or replace function public.get_wishlist_matches(p_entry_id uuid)
returns setof uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_w   public.wishlist_entries%rowtype;
begin
  if v_uid is null then raise exception 'Not signed in'; end if;
  select * into v_w from public.wishlist_entries where id = p_entry_id and user_id = v_uid;
  if not found then raise exception 'Wishlist entry not found'; end if;

  return query
    select i.id
      from public.items i
     where i.owner_id <> v_uid
       and i.qty_available > 0
       and public.wish_name_matches(v_w.name, i.name)
     order by i.updated_at desc;
end;
$$;

revoke execute on function public.get_my_wishlist(date)        from public, anon;
revoke execute on function public.get_wishlist_matches(uuid)   from public, anon;
grant  execute on function public.get_my_wishlist(date)        to authenticated;
grant  execute on function public.get_wishlist_matches(uuid)   to authenticated;

-- Nightly backstop: delete entries whose need-by date has passed, even for
-- users who never open the app. Uses a one-day grace so phones behind UTC
-- never lose an entry early; get_my_wishlist handles the exact local cutoff.
-- Only create pg_cron when it isn't installed. Supabase runs its own permission
-- setup on every CREATE EXTENSION (even "if not exists"), and repeating that on
-- a re-run fails with "dependent privileges exist". That setup also grants
-- everything needed, so no extra grants here.
do $$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      create extension pg_cron with schema pg_catalog;
    exception when others then
      -- Never let Supabase's extension permission setup fail the whole script.
      raise notice 'pg_cron setup skipped: %', sqlerrm;
    end;
  end if;
end;
$$;

select cron.schedule(
  'teamswap-delete-expired-wishlist',
  '15 0 * * *',   -- 00:15 UTC daily; scheduling again by name replaces the job
  $cron$delete from public.wishlist_entries where need_by < current_date - 1$cron$
);

delete from public.wishlist_entries where need_by < current_date - 1;

-- =====================================================================
-- STAGE 2 · Part C — Notifications
-- Rows are created only by the triggers below (never by the app).
-- Users can read their own and mark them read through a function.
-- =====================================================================
create table if not exists public.notifications (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  type               text not null,
  title              text not null,
  body               text not null default '',
  request_id         uuid references public.requests (id) on delete cascade,
  item_id            uuid references public.items (id) on delete cascade,
  wishlist_entry_id  uuid references public.wishlist_entries (id) on delete cascade,
  read_at            timestamptz,
  created_at         timestamptz not null default now()
);
-- Allowed types (kept as a named constraint so re-runs can widen the list).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'request_received', 'request_approved', 'request_denied', 'wishlist_match',
  'final_date_set', 'item_sent', 'item_received'
));
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;
-- One match notification per (wishlist entry, item), ever.
create unique index if not exists notifications_match_once
  on public.notifications (wishlist_entry_id, item_id) where type = 'wishlist_match';

alter table public.notifications enable row level security;

drop policy if exists "users read own notifications" on public.notifications;
create policy "users read own notifications" on public.notifications
  for select to authenticated using (user_id = auth.uid());

grant select on public.notifications to authenticated;
revoke all on public.notifications from anon;

-- Mark some (p_ids) or all (null) of my notifications as read.
create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  update public.notifications
     set read_at = now()
   where user_id = auth.uid()
     and read_at is null
     and (p_ids is null or id = any (p_ids));
end;
$$;

revoke execute on function public.mark_notifications_read(uuid[]) from public, anon;
grant  execute on function public.mark_notifications_read(uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Request events → owner gets "new request"; requester gets approved/denied.
-- ---------------------------------------------------------------------
create or replace function public.notify_request_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team   text;
  v_actor  uuid := auth.uid();
  v_to     uuid;
  v_window text;
begin
  if tg_op = 'INSERT' then
    select team_name into v_team from public.profiles where id = new.requester_id;
    insert into public.notifications (user_id, type, title, body, request_id, item_id)
    values (
      new.owner_id, 'request_received',
      'New request for ' || new.item_name,
      coalesce(v_team, 'A team') || ' wants ' || new.qty || ' · need by ' || to_char(new.need_by, 'Mon FMDD'),
      new.id, new.item_id
    );
  elsif new.status is distinct from old.status and new.status in ('approved', 'denied') then
    select team_name into v_team from public.profiles where id = new.owner_id;
    if new.status = 'approved' then
      insert into public.notifications (user_id, type, title, body, request_id, item_id)
      values (
        new.requester_id, 'request_approved',
        coalesce(v_team, 'The owner') || ' approved your request for ' || new.item_name,
        new.qty || ' × ' || new.item_name || ' · contact info is now unlocked',
        new.id, new.item_id
      );
    else
      insert into public.notifications (user_id, type, title, body, request_id, item_id)
      values (
        new.requester_id, 'request_denied',
        'Request for ' || new.item_name || ' declined',
        coalesce(v_team, 'The owner') || ' couldn''t share ' || new.item_name || ' this time',
        new.id, new.item_id
      );
    end if;
  end if;

  if tg_op = 'UPDATE' and new.status = 'approved' then
    -- Final date (or the owner's drop-off window) set or changed → tell the other person.
    if new.final_date is not null
       and (new.final_date is distinct from old.final_date
            or new.dropoff_start is distinct from old.dropoff_start
            or new.dropoff_end is distinct from old.dropoff_end) then
      v_to := case when v_actor = new.requester_id then new.owner_id else new.requester_id end;
      select team_name into v_team from public.profiles
       where id = case when v_to = new.owner_id then new.requester_id else new.owner_id end;
      v_window := case
        when new.dropoff_start is not null and new.dropoff_end is not null then
          ' · drop-off ' || to_char(to_timestamp(new.dropoff_start, 'HH24:MI'), 'FMHH12:MI AM')
          || '–' || to_char(to_timestamp(new.dropoff_end, 'HH24:MI'), 'FMHH12:MI AM')
        else '' end;
      insert into public.notifications (user_id, type, title, body, request_id, item_id)
      values (
        v_to, 'final_date_set',
        'Pickup set for ' || new.item_name || ' · ' || to_char(new.final_date, 'Dy, Mon FMDD'),
        coalesce(v_team, 'The other team') || ' confirmed the final date for ' || new.item_name || v_window,
        new.id, new.item_id
      );
    end if;

    -- Owner marked it sent → tell the requester.
    if new.sent_at is not null and old.sent_at is null then
      select team_name into v_team from public.profiles where id = new.owner_id;
      insert into public.notifications (user_id, type, title, body, request_id, item_id)
      values (
        new.requester_id, 'item_sent',
        coalesce(v_team, 'The owner') || ' sent ' || new.item_name,
        new.qty || ' × ' || new.item_name || ' · tap Mark as received once you have it',
        new.id, new.item_id
      );
    end if;
  end if;

  -- Requester marked it received → tell the owner.
  if tg_op = 'UPDATE' and new.status = 'received' and old.status is distinct from 'received' then
    select team_name into v_team from public.profiles where id = new.requester_id;
    insert into public.notifications (user_id, type, title, body, request_id, item_id)
    values (
      new.owner_id, 'item_received',
      coalesce(v_team, 'The requester') || ' received ' || new.item_name,
      new.qty || ' × ' || new.item_name || ' · exchange complete and removed from your inventory',
      new.id, new.item_id
    );
  end if;

  return null;
end;
$$;

drop trigger if exists requests_notify_trg on public.requests;
create trigger requests_notify_trg
  after insert or update of status, final_date, dropoff_start, dropoff_end, sent_at on public.requests
  for each row execute function public.notify_request_events();

-- ---------------------------------------------------------------------
-- Wishlist matches → when an item becomes available (0 → some) or is
-- renamed while available, notify every other user whose active
-- wishlist entry matches it. Each (entry, item) pair is notified once.
-- ---------------------------------------------------------------------
create or replace function public.notify_wishlist_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_team text;
begin
  if new.qty_available <= 0 then return null; end if;
  if tg_op = 'UPDATE'
     and old.qty_available > 0
     and old.name = new.name then
    return null; -- already available and unchanged: not a new match
  end if;

  select team_name into v_team from public.profiles where id = new.owner_id;

  insert into public.notifications (user_id, type, title, body, item_id, wishlist_entry_id)
  select w.user_id, 'wishlist_match',
         'New match for “' || w.name || '”',
         coalesce(v_team, 'A team') || ' has ' || new.name || ' available (' || new.qty_available || ')',
         new.id, w.id
    from public.wishlist_entries w
   where w.user_id <> new.owner_id
     and w.need_by >= current_date
     and public.wish_name_matches(w.name, new.name)
  on conflict (wishlist_entry_id, item_id) where type = 'wishlist_match' do nothing;

  return null;
end;
$$;

drop trigger if exists items_wishlist_match_trg on public.items;
create trigger items_wishlist_match_trg
  after insert or update of qty_available, name on public.items
  for each row execute function public.notify_wishlist_matches();

-- ---------------------------------------------------------------------
-- Wishlist matches, entry side → when someone adds a wishlist entry (or
-- renames it), notify them about matching items that are ALREADY available.
-- The item-side trigger above covers items that become available later.
-- Same once-per-(entry, item) rule; at most 10 per add/rename.
-- ---------------------------------------------------------------------
create or replace function public.notify_entry_matches()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.need_by < current_date then return null; end if;
  if tg_op = 'UPDATE' and old.name = new.name then return null; end if;

  insert into public.notifications (user_id, type, title, body, item_id, wishlist_entry_id)
  select new.user_id, 'wishlist_match',
         'New match for “' || new.name || '”',
         coalesce(p.team_name, 'A team') || ' has ' || i.name || ' available (' || i.qty_available || ')',
         i.id, new.id
    from public.items i
    left join public.profiles p on p.id = i.owner_id
   where i.owner_id <> new.user_id
     and i.qty_available > 0
     and public.wish_name_matches(new.name, i.name)
   order by i.updated_at desc
   limit 10
  on conflict (wishlist_entry_id, item_id) where type = 'wishlist_match' do nothing;

  return null;
end;
$$;

drop trigger if exists wishlist_entry_match_trg on public.wishlist_entries;
create trigger wishlist_entry_match_trg
  after insert or update of name on public.wishlist_entries
  for each row execute function public.notify_entry_matches();

revoke execute on function public.notify_entry_matches() from public, anon, authenticated;

-- One-time catch-up: notify about matches that existed before these triggers
-- (entries added while the item was already available). Safe to re-run: each
-- (entry, item) pair is only ever notified once.
insert into public.notifications (user_id, type, title, body, item_id, wishlist_entry_id)
select w.user_id, 'wishlist_match',
       'New match for “' || w.name || '”',
       coalesce(p.team_name, 'A team') || ' has ' || i.name || ' available (' || i.qty_available || ')',
       i.id, w.id
  from public.wishlist_entries w
  join public.items i
    on i.owner_id <> w.user_id
   and i.qty_available > 0
   and public.wish_name_matches(w.name, i.name)
  left join public.profiles p on p.id = i.owner_id
 where w.need_by >= current_date
on conflict (wishlist_entry_id, item_id) where type = 'wishlist_match' do nothing;

revoke execute on function public.notify_request_events()   from public, anon, authenticated;
revoke execute on function public.notify_wishlist_matches() from public, anon, authenticated;

-- Live updates: stream my notification rows to the app (RLS still applies).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

-- Keep history tidy: delete notifications older than 90 days, nightly.
select cron.schedule(
  'teamswap-delete-old-notifications',
  '20 0 * * *',
  $cron$delete from public.notifications where created_at < now() - interval '90 days'$cron$
);
