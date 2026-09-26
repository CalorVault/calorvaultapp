import { getSupabaseClient } from './supabase';
import { CommunityComment, CommunityPost, CommunityProfile } from '../types';

export class CommunityError extends Error {}

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(raw: string): boolean {
  return USERNAME_PATTERN.test(normalizeUsername(raw));
}

function client(url: string, anonKey: string) {
  return getSupabaseClient(url, anonKey);
}

async function requireUserId(url: string, anonKey: string): Promise<string> {
  const { data, error } = await client(url, anonKey).auth.getUser();
  if (error) throw new CommunityError(error.message);
  if (!data.user) throw new CommunityError('Not signed in.');
  return data.user.id;
}

export async function hasSession(url: string, anonKey: string): Promise<boolean> {
  const { data } = await client(url, anonKey).auth.getSession();
  return !!data.session;
}

export async function signUp(
  url: string,
  anonKey: string,
  email: string,
  password: string,
  username: string
): Promise<void> {
  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) {
    throw new CommunityError('Usernames must be 3-20 characters: letters, numbers, underscores only.');
  }
  const supabase = client(url, anonKey);
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) throw new CommunityError(error.message);
  const userId = data.user?.id;
  if (!userId) throw new CommunityError('Sign up did not return a user.');

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: userId, username: normalized });
  if (profileError) {
    if (profileError.code === '23505') throw new CommunityError('That username is already taken.');
    throw new CommunityError(profileError.message);
  }
}

export async function signIn(
  url: string,
  anonKey: string,
  email: string,
  password: string
): Promise<void> {
  const { error } = await client(url, anonKey).auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw new CommunityError(error.message);
}

export async function signOut(url: string, anonKey: string): Promise<void> {
  await client(url, anonKey).auth.signOut();
}

export async function getMyProfile(url: string, anonKey: string): Promise<CommunityProfile | null> {
  const supabase = client(url, anonKey);
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, created_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new CommunityError(error.message);
  if (!data) return null;
  return { id: data.id, username: data.username, createdAt: data.created_at };
}

// Accounts whose profile insert failed at sign-up (e.g. before email
// confirmation was turned off) have no username yet; this lets them pick one.
export async function createMyProfile(url: string, anonKey: string, username: string): Promise<void> {
  const normalized = normalizeUsername(username);
  if (!isValidUsername(normalized)) {
    throw new CommunityError('Usernames must be 3-20 characters: letters, numbers, underscores only.');
  }
  const userId = await requireUserId(url, anonKey);
  const { error } = await client(url, anonKey).from('profiles').insert({ id: userId, username: normalized });
  if (error) {
    if (error.code === '23505') throw new CommunityError('That username is already taken.');
    throw new CommunityError(error.message);
  }
}

export async function addFriendByUsername(
  url: string,
  anonKey: string,
  username: string
): Promise<void> {
  const supabase = client(url, anonKey);
  const myId = await requireUserId(url, anonKey);
  const normalized = normalizeUsername(username);

  const { data: friendProfile, error: findError } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', normalized)
    .maybeSingle();
  if (findError) throw new CommunityError(findError.message);
  if (!friendProfile) throw new CommunityError('No user with that username.');
  if (friendProfile.id === myId) throw new CommunityError("You can't add yourself.");

  const { error } = await supabase
    .from('friendships')
    .insert({ user_id: myId, friend_id: friendProfile.id });
  if (error) {
    if (error.code === '23505') throw new CommunityError("You're already friends with them.");
    throw new CommunityError(error.message);
  }
}

export async function listFriends(url: string, anonKey: string): Promise<CommunityProfile[]> {
  const supabase = client(url, anonKey);
  const myId = await requireUserId(url, anonKey);

  const { data: rows, error } = await supabase
    .from('friendships')
    .select('friend_id')
    .eq('user_id', myId);
  if (error) throw new CommunityError(error.message);
  const ids = (rows ?? []).map((r) => r.friend_id as string);
  if (ids.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, created_at')
    .in('id', ids);
  if (profileError) throw new CommunityError(profileError.message);
  return (profiles ?? []).map((p) => ({
    id: p.id as string,
    username: p.username as string,
    createdAt: p.created_at as string,
  }));
}

export async function listFeed(url: string, anonKey: string, limit = 30): Promise<CommunityPost[]> {
  const supabase = client(url, anonKey);
  const myId = await requireUserId(url, anonKey);

  const { data: postRows, error } = await supabase
    .from('posts')
    .select('id, author_id, caption, photo_url, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new CommunityError(error.message);
  const posts = postRows ?? [];
  if (posts.length === 0) return [];

  const postIds = posts.map((p) => p.id as string);
  const authorIds = Array.from(new Set(posts.map((p) => p.author_id as string)));

  const [{ data: authors }, { data: likeRows }, { data: commentRows }, { data: myLikeRows }] =
    await Promise.all([
      supabase.from('profiles').select('id, username').in('id', authorIds),
      supabase.from('likes').select('post_id').in('post_id', postIds),
      supabase.from('comments').select('post_id').in('post_id', postIds),
      supabase.from('likes').select('post_id').in('post_id', postIds).eq('user_id', myId),
    ]);

  const usernameById = new Map((authors ?? []).map((a) => [a.id as string, a.username as string]));
  const likeCountByPost = new Map<string, number>();
  for (const row of likeRows ?? []) {
    const id = row.post_id as string;
    likeCountByPost.set(id, (likeCountByPost.get(id) ?? 0) + 1);
  }
  const commentCountByPost = new Map<string, number>();
  for (const row of commentRows ?? []) {
    const id = row.post_id as string;
    commentCountByPost.set(id, (commentCountByPost.get(id) ?? 0) + 1);
  }
  const likedByMeSet = new Set((myLikeRows ?? []).map((r) => r.post_id as string));

  return posts.map((p) => ({
    id: p.id as string,
    authorId: p.author_id as string,
    authorUsername: usernameById.get(p.author_id as string) ?? 'unknown',
    caption: (p.caption as string) ?? '',
    photoUrl: (p.photo_url as string | null) ?? undefined,
    createdAt: p.created_at as string,
    likeCount: likeCountByPost.get(p.id as string) ?? 0,
    likedByMe: likedByMeSet.has(p.id as string),
    commentCount: commentCountByPost.get(p.id as string) ?? 0,
  }));
}

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64ToBytes(base64: string): Uint8Array {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    if (char === '=') break;
    const value = BASE64_CHARS.indexOf(char);
    if (value === -1) continue;
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

export async function createPost(
  url: string,
  anonKey: string,
  caption: string,
  photoBase64?: string
): Promise<void> {
  const supabase = client(url, anonKey);
  const myId = await requireUserId(url, anonKey);

  let photoUrl: string | undefined;
  if (photoBase64) {
    const path = `${myId}/${Date.now()}.jpg`;
    const bytes = base64ToBytes(photoBase64);
    const { error: uploadError } = await supabase.storage
      .from('post-photos')
      .upload(path, bytes, { contentType: 'image/jpeg' });
    if (uploadError) throw new CommunityError(uploadError.message);
    const { data: publicUrlData } = supabase.storage.from('post-photos').getPublicUrl(path);
    photoUrl = publicUrlData.publicUrl;
  }

  const { error } = await supabase
    .from('posts')
    .insert({ author_id: myId, caption: caption.trim(), photo_url: photoUrl });
  if (error) throw new CommunityError(error.message);
}

export async function deletePost(url: string, anonKey: string, postId: string): Promise<void> {
  const { error } = await client(url, anonKey).from('posts').delete().eq('id', postId);
  if (error) throw new CommunityError(error.message);
}

export async function toggleLike(
  url: string,
  anonKey: string,
  postId: string,
  liked: boolean
): Promise<void> {
  const supabase = client(url, anonKey);
  const myId = await requireUserId(url, anonKey);
  if (liked) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', myId);
    if (error) throw new CommunityError(error.message);
  } else {
    const { error } = await supabase.from('likes').insert({ post_id: postId, user_id: myId });
    if (error) throw new CommunityError(error.message);
  }
}

export async function listComments(
  url: string,
  anonKey: string,
  postId: string
): Promise<CommunityComment[]> {
  const supabase = client(url, anonKey);
  const { data: rows, error } = await supabase
    .from('comments')
    .select('id, post_id, author_id, body, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw new CommunityError(error.message);
  const comments = rows ?? [];
  if (comments.length === 0) return [];

  const authorIds = Array.from(new Set(comments.map((c) => c.author_id as string)));
  const { data: authors } = await supabase.from('profiles').select('id, username').in('id', authorIds);
  const usernameById = new Map((authors ?? []).map((a) => [a.id as string, a.username as string]));

  return comments.map((c) => ({
    id: c.id as string,
    postId: c.post_id as string,
    authorId: c.author_id as string,
    authorUsername: usernameById.get(c.author_id as string) ?? 'unknown',
    body: c.body as string,
    createdAt: c.created_at as string,
  }));
}

export async function addComment(
  url: string,
  anonKey: string,
  postId: string,
  body: string
): Promise<void> {
  const myId = await requireUserId(url, anonKey);
  const { error } = await client(url, anonKey)
    .from('comments')
    .insert({ post_id: postId, author_id: myId, body: body.trim() });
  if (error) throw new CommunityError(error.message);
}
