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

-- Weekly score and streak each user shares with friends for the ranking
-- (added later; safe to re-run).
alter table profiles add column if not exists week_score smallint;
alter table profiles add column if not exists week_start date;
alter table profiles add column if not exists streak smallint;

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

-- ---------- Account deletion ----------
-- Lets the app remove your own post photos (stored in a folder named after
-- your user id) and delete your account. Deleting the auth user cascades to
-- your profile, friendships, posts, likes and comments.

drop policy if exists "post photos delete own" on storage.objects;
create policy "post photos delete own" on storage.objects for delete
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function delete_my_account() from public, anon;
grant execute on function delete_my_account() to authenticated;

-- ---------- AI proxy usage limits ----------
-- Counts AI requests per phone per day for the ai-proxy Edge Function. Only
-- the function (server key) can touch it: RLS on with no policies, and the
-- counter function isn't callable by app users.

create table if not exists ai_usage (
  day date not null default current_date,
  install_id text not null,
  count integer not null default 0,
  primary key (day, install_id)
);
alter table ai_usage enable row level security;

create or replace function bump_ai_usage(p_install text, p_install_limit int, p_global_limit int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  mine int;
  total int;
begin
  select coalesce(sum(count), 0) into total from ai_usage where day = current_date;
  if total >= p_global_limit then
    return false;
  end if;
  insert into ai_usage (day, install_id, count) values (current_date, p_install, 1)
  on conflict (day, install_id) do update set count = ai_usage.count + 1
  returning count into mine;
  return mine <= p_install_limit;
end;
$$;

revoke all on function bump_ai_usage(text, int, int) from public, anon, authenticated;
grant execute on function bump_ai_usage(text, int, int) to service_role;

-- ---------- Security update 1 (run after the sections above) ----------

-- 1. Post photos: images only, at most 10 MB, and only into your own folder.
update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/heic']
where id = 'post-photos';

drop policy if exists "post photos authenticated upload" on storage.objects;
drop policy if exists "post photos upload own folder" on storage.objects;
create policy "post photos upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- 2. Sensible limits on what can be saved.
alter table posts drop constraint if exists posts_caption_length;
alter table posts add constraint posts_caption_length
  check (char_length(caption) <= 1000) not valid;

alter table posts drop constraint if exists posts_photo_url_ours;
alter table posts add constraint posts_photo_url_ours
  check (photo_url is null or photo_url like '%/storage/v1/object/public/post-photos/%') not valid;

alter table posts drop constraint if exists posts_nutrition_range;
alter table posts add constraint posts_nutrition_range
  check (
    coalesce(calories, 0) between 0 and 20000
    and coalesce(protein_g, 0) between 0 and 2000
    and coalesce(carbs_g, 0) between 0 and 2000
    and coalesce(fat_g, 0) between 0 and 2000
  ) not valid;

alter table comments drop constraint if exists comments_body_length;
alter table comments add constraint comments_body_length
  check (char_length(btrim(body)) between 1 and 500) not valid;

alter table profiles drop constraint if exists profiles_username_format;
alter table profiles add constraint profiles_username_format
  check (username ~ '^[a-z0-9_]{3,20}$') not valid;

alter table profiles drop constraint if exists profiles_week_stats_range;
alter table profiles add constraint profiles_week_stats_range
  check (
    (week_score is null or week_score between 0 and 100)
    and (streak is null or streak between 0 and 3660)
  ) not valid;

-- 3. Only signed-in users can look up usernames (stops anyone scraping the user list).
drop policy if exists "profiles select all" on profiles;
drop policy if exists "profiles select signed in" on profiles;
create policy "profiles select signed in" on profiles for select to authenticated using (true);

-- 4. You can only like or comment on posts you're allowed to see.
drop policy if exists "likes insert own" on likes;
create policy "likes insert own" on likes for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from posts p
      where p.id = likes.post_id
        and (p.author_id = auth.uid() or auth.uid() in (select user_id from friendships where friend_id = p.author_id))
    )
  );

drop policy if exists "comments insert own" on comments;
create policy "comments insert own" on comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from posts p
      where p.id = comments.post_id
        and (p.author_id = auth.uid() or auth.uid() in (select user_id from friendships where friend_id = p.author_id))
    )
  );


-- Photos are viewed through their public links, so nobody needs to list the
-- whole bucket; you can only list (and so delete) files in your own folder.
drop policy if exists "post photos public read" on storage.objects;
drop policy if exists "post photos read own folder" on storage.objects;
create policy "post photos read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'post-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------- Security update 2: report and block ----------

-- ---------- Blocking ----------
-- Blocking someone removes the friendship both ways, stops either of you
-- adding the other again, and hides each other's posts and comments.

create table if not exists blocks (
  blocker_id uuid not null references profiles(id) on delete cascade,
  blocked_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table blocks enable row level security;

drop policy if exists "blocks select own" on blocks;
create policy "blocks select own" on blocks for select to authenticated using (blocker_id = auth.uid());

drop policy if exists "blocks delete own" on blocks;
create policy "blocks delete own" on blocks for delete to authenticated using (blocker_id = auth.uid());

-- True when you've blocked this person or they've blocked you. Runs with
-- owner rights so it can see blocks made by the other person.
create or replace function is_blocked_with(other uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from blocks
    where (blocker_id = auth.uid() and blocked_id = other)
       or (blocker_id = other and blocked_id = auth.uid())
  );
$$;
revoke all on function is_blocked_with(uuid) from public, anon;
grant execute on function is_blocked_with(uuid) to authenticated;

create or replace function block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if p_user is null or p_user = auth.uid() then
    raise exception 'You can''t block yourself';
  end if;
  insert into blocks (blocker_id, blocked_id) values (auth.uid(), p_user)
  on conflict do nothing;
  delete from friendships
  where (user_id = auth.uid() and friend_id = p_user)
     or (user_id = p_user and friend_id = auth.uid());
end;
$$;
revoke all on function block_user(uuid) from public, anon;
grant execute on function block_user(uuid) to authenticated;

drop policy if exists "friendships insert own" on friendships;
create policy "friendships insert own" on friendships for insert
  with check (user_id = auth.uid() and friend_id != auth.uid() and not is_blocked_with(friend_id));

drop policy if exists "posts select visible" on posts;
create policy "posts select visible" on posts for select
  using (
    author_id = auth.uid()
    or (
      auth.uid() in (select user_id from friendships where friend_id = posts.author_id)
      and not is_blocked_with(posts.author_id)
    )
  );

drop policy if exists "comments select visible" on comments;
create policy "comments select visible" on comments for select
  using (
    exists (
      select 1 from posts p
      where p.id = comments.post_id
        and (p.author_id = auth.uid() or auth.uid() in (select user_id from friendships where friend_id = p.author_id))
    )
    and (comments.author_id = auth.uid() or not is_blocked_with(comments.author_id))
  );

-- ---------- Reports ----------
-- Reports land in this table for you to review in the Supabase Table Editor.
-- App users can't read it (RLS on, no policies); they can only add to it
-- through report_content(), which saves a copy of what was reported so the
-- evidence stays even if the post is deleted.

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reporter_id uuid references auth.users(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete set null,
  reported_username text,
  post_id uuid references posts(id) on delete set null,
  comment_id uuid references comments(id) on delete set null,
  content text,
  photo_url text,
  status text not null default 'open'
);
alter table reports enable row level security;

create or replace function report_content(p_post uuid default null, p_comment uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  v_author uuid;
  v_post uuid := p_post;
  v_post_author uuid;
  v_content text;
  v_photo text;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;

  if p_comment is not null then
    select c.author_id, c.body, c.post_id into v_author, v_content, v_post
    from comments c where c.id = p_comment;
    select p.author_id into v_post_author from posts p where p.id = v_post;
  elsif p_post is not null then
    select p.author_id, p.caption, p.photo_url into v_author, v_content, v_photo
    from posts p where p.id = p_post;
    v_post_author := v_author;
  end if;

  if v_author is null then
    raise exception 'Nothing to report';
  end if;
  if v_author = me then
    return;
  end if;
  -- Only things you can actually see: your own posts or posts of people you follow.
  if v_post_author is distinct from me
     and not exists (select 1 from friendships where user_id = me and friend_id = v_post_author) then
    raise exception 'Nothing to report';
  end if;
  -- One report per thing per person, and at most 20 reports a day.
  if exists (
    select 1 from reports
    where reporter_id = me
      and post_id is not distinct from v_post
      and comment_id is not distinct from p_comment
  ) then
    return;
  end if;
  if (select count(*) from reports where reporter_id = me and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Too many reports today, try again tomorrow';
  end if;

  insert into reports (reporter_id, reported_user_id, reported_username, post_id, comment_id, content, photo_url)
  values (
    me,
    v_author,
    (select username from profiles where id = v_author),
    v_post,
    p_comment,
    v_content,
    v_photo
  );
end;
$$;
revoke all on function report_content(uuid, uuid) from public, anon;
grant execute on function report_content(uuid, uuid) to authenticated;


-- ---------- AI answer cache ----------
-- Repeat text questions are answered from here by the ai-proxy function (server
-- key only: RLS on, no policies).
create table if not exists ai_cache (
  key text primary key,
  response jsonb not null,
  created_at timestamptz not null default now()
);
alter table ai_cache enable row level security;
