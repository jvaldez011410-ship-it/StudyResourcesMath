-- MY MUSIC: shared music + private playlists
-- Run this in Supabase SQL Editor.
--
-- Result:
--   shared_songs = one shared collection visible to every signed-in user.
--   playlist_songs = private links between a user's playlists and shared songs.
--   Removing a song from a playlist NEVER deletes the shared song.
--   Regular users cannot delete shared songs or storage files.

create table if not exists public.shared_songs (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  storage_path text not null unique,
  duration double precision not null default 0,
  mime_type text,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.playlist_songs (
  id uuid primary key default gen_random_uuid(),
  playlist_id uuid not null references public.playlists(id) on delete cascade,
  song_id uuid not null references public.shared_songs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (playlist_id, song_id)
);

alter table public.shared_songs enable row level security;
alter table public.playlist_songs enable row level security;

-- Everyone with an account can see shared songs.
drop policy if exists "Authenticated users can view shared songs" on public.shared_songs;
create policy "Authenticated users can view shared songs"
on public.shared_songs
for select
to authenticated
using (true);

-- Any signed-in user may upload a song to the shared collection.
drop policy if exists "Authenticated users can upload shared songs" on public.shared_songs;
create policy "Authenticated users can upload shared songs"
on public.shared_songs
for insert
to authenticated
with check (uploaded_by = auth.uid());

-- There are intentionally NO update/delete policies on shared_songs.
-- Regular users cannot delete or edit shared songs.

-- A user can only see links belonging to their own playlists.
drop policy if exists "Users view their playlist songs" on public.playlist_songs;
create policy "Users view their playlist songs"
on public.playlist_songs
for select
to authenticated
using (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.user_id = auth.uid()
  )
);

drop policy if exists "Users add songs to their playlists" on public.playlist_songs;
create policy "Users add songs to their playlists"
on public.playlist_songs
for insert
to authenticated
with check (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.user_id = auth.uid()
  )
);

drop policy if exists "Users remove songs from their playlists" on public.playlist_songs;
create policy "Users remove songs from their playlists"
on public.playlist_songs
for delete
to authenticated
using (
  exists (
    select 1 from public.playlists p
    where p.id = playlist_id and p.user_id = auth.uid()
  )
);

-- Keep the existing private bucket, but make its audio readable by any
-- signed-in user. The app still uses signed URLs for playback.
insert into storage.buckets (id, name, public)
values ('music', 'music', false)
on conflict (id) do update set public = false;

drop policy if exists "Users upload their own music" on storage.objects;
drop policy if exists "Users read their own music" on storage.objects;
drop policy if exists "Users delete their own music" on storage.objects;
drop policy if exists "Users update their own music" on storage.objects;
drop policy if exists "Authenticated users can upload shared music" on storage.objects;
drop policy if exists "Authenticated users can read shared music" on storage.objects;

create policy "Authenticated users can upload shared music"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'music'
  and (storage.foldername(name))[1] = 'shared'
);

create policy "Authenticated users can read shared music"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'music'
);

-- Only the account that originally uploaded a shared song may delete
-- its storage object. The policy verifies ownership through shared_songs,
-- so hiding the delete button in the browser is not the security boundary.
drop policy if exists "Owners can delete their shared music" on storage.objects;
create policy "Owners can delete their shared music"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'music'
  and exists (
    select 1
    from public.shared_songs s
    where s.storage_path = name
      and s.uploaded_by = auth.uid()
  )
);

-- Only the uploader may remove the corresponding database record.
drop policy if exists "Owners can delete their shared songs" on public.shared_songs;
create policy "Owners can delete their shared songs"
on public.shared_songs
for delete
to authenticated
using (uploaded_by = auth.uid());

-- Migrate existing songs from the old per-playlist design.
-- This keeps existing uploaded files and makes each old song shared.
insert into public.shared_songs
  (id, title, storage_path, duration, mime_type, uploaded_by, created_at)
select
  s.id,
  s.title,
  s.storage_path,
  s.duration,
  s.mime_type,
  s.user_id,
  s.created_at
from public.songs s
on conflict (id) do nothing;

insert into public.playlist_songs
  (playlist_id, song_id, created_at)
select
  s.playlist_id,
  s.id,
  s.created_at
from public.songs s
on conflict (playlist_id, song_id) do nothing;

-- The old public.songs table can be left in place for safety.
-- The website no longer uses it.
