-- CalorVault Community schema.
-- Paste this whole file into the Supabase SQL Editor (Project -> SQL Editor -> New query) and run it once.
-- Safe to re-run: uses "if not exists" / "on conflict do nothing" everywhere it can.

create extension if not exists pgcrypto;

-- ---------- Tables ----------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists friendships (
  user_id uuid not null references profiles(id) on delete cascade,
  friend_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id)
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  caption text not null default '',
  photo_url text,
  created_at timestamptz not null default now()
);

-- Optional nutrition of the meal a post is about (added later; safe to re-run).
alter table posts add column if not exists calories integer;
alter table posts add column if not exists protein_g integer;
alter table posts add column if not exists carbs_g integer;
alter table posts add column if not exists fat_g integer;

create table if not exists likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

-- ---------- Row Level Security ----------

alter table profiles enable row level security;
alter table friendships enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;

-- Profiles: any signed-in user can look up a username (needed to add friends
-- and to show author names on posts); you can only create/edit your own row.
drop policy if exists "profiles select all" on profiles;
create policy "profiles select all" on profiles for select using (true);

drop policy if exists "profiles insert own" on profiles;
create policy "profiles insert own" on profiles for insert with check (id = auth.uid());

drop policy if exists "profiles update own" on profiles;
create policy "profiles update own" on profiles for update using (id = auth.uid());

-- Friendships: you can only see/add/remove your own list. Adding someone as
-- a friend is one-directional -- it means "let me see their posts" (like a
-- follow), it doesn't require them to add you back.
drop policy if exists "friendships select own" on friendships;
create policy "friendships select own" on friendships for select using (user_id = auth.uid());

drop policy if exists "friendships insert own" on friendships;
create policy "friendships insert own" on friendships for insert
  with check (user_id = auth.uid() and friend_id != auth.uid());

drop policy if exists "friendships delete own" on friendships;
create policy "friendships delete own" on friendships for delete using (user_id = auth.uid());

-- Posts: visible to their author and to anyone who has added the author as
-- a friend. You can only create posts as yourself, and only delete your own.
drop policy if exists "posts select visible" on posts;
create policy "posts select visible" on posts for select
  using (
    author_id = auth.uid()
    or auth.uid() in (select user_id from friendships where friend_id = posts.author_id)
  );

drop policy if exists "posts insert own" on posts;
create policy "posts insert own" on posts for insert with check (author_id = auth.uid());

drop policy if exists "posts delete own" on posts;
create policy "posts delete own" on posts for delete using (author_id = auth.uid());

-- Likes: same visibility as the post they're on; you can only like/unlike as yourself.
drop policy if exists "likes select visible" on likes;
create policy "likes select visible" on likes for select
  using (
    exists (
      select 1 from posts p
      where p.id = likes.post_id
        and (p.author_id = auth.uid() or auth.uid() in (select user_id from friendships where friend_id = p.author_id))
    )
  );

drop policy if exists "likes insert own" on likes;
create policy "likes insert own" on likes for insert with check (user_id = auth.uid());

drop policy if exists "likes delete own" on likes;
create policy "likes delete own" on likes for delete using (user_id = auth.uid());

-- Comments: same visibility as the post they're on; you can only comment as yourself.
drop policy if exists "comments select visible" on comments;
create policy "comments select visible" on comments for select
  using (
    exists (
      select 1 from posts p
      where p.id = comments.post_id
        and (p.author_id = auth.uid() or auth.uid() in (select user_id from friendships where friend_id = p.author_id))
    )
  );

drop policy if exists "comments insert own" on comments;
create policy "comments insert own" on comments for insert with check (author_id = auth.uid());

-- ---------- Storage (post photos) ----------

insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', true)
on conflict (id) do nothing;

drop policy if exists "post photos public read" on storage.objects;
create policy "post photos public read" on storage.objects for select
  using (bucket_id = 'post-photos');

drop policy if exists "post photos authenticated upload" on storage.objects;
create policy "post photos authenticated upload" on storage.objects for insert
  with check (bucket_id = 'post-photos' and auth.role() = 'authenticated');
