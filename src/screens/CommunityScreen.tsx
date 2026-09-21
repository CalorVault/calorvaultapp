import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommunityIcon, SettingsIcon } from '../components/NavIcons';
import { useApp } from '../context/AppContext';
import {
  addComment,
  addFriendByUsername,
  CommunityError,
  createPost,
  deletePost,
  getMyProfile,
  hasSession,
  listComments,
  listFeed,
  listFriends,
  signIn,
  signOut,
  signUp,
  toggleLike,
} from '../lib/community';
import { RecipesScreenNavigationProp } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import { CommunityComment, CommunityPost, CommunityProfile } from '../types';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function CommunityScreen() {
  const navigation = useNavigation<RecipesScreenNavigationProp>();
  const { t, supabaseUrl, supabaseAnonKey } = useApp();

  if (!supabaseUrl || !supabaseAnonKey) {
    return (
      <SafeAreaView style={styles.flex} edges={['top']}>
        <CommunityTopBar t={t} navigation={navigation} />
        <View style={styles.body}>
          <View style={styles.iconWrap}>
            <CommunityIcon size={40} color={colors.textMuted} />
          </View>
          <Text style={styles.heading}>{t.community.setupNeededTitle}</Text>
          <Text style={styles.copy}>{t.community.setupNeededCopy}</Text>
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedDim]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.primaryButtonText}>{t.community.goToSettings}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <CommunityConfigured
      url={supabaseUrl}
      anonKey={supabaseAnonKey}
      t={t}
      navigation={navigation}
    />
  );
}

function CommunityTopBar({ t, navigation }: { t: any; navigation: RecipesScreenNavigationProp }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.titleRow}>
        <CommunityIcon size={26} color={colors.text} />
        <Text style={styles.title}>{t.community.title}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [styles.settingsButton, pressed && styles.pressedDim]}
        onPress={() => navigation.navigate('Settings')}
        hitSlop={8}
        accessibilityLabel={t.common.settings}
        accessibilityRole="button"
      >
        <SettingsIcon size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

function CommunityConfigured({
  url,
  anonKey,
  t,
  navigation,
}: {
  url: string;
  anonKey: string;
  t: any;
  navigation: RecipesScreenNavigationProp;
}) {
  const [checking, setChecking] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await hasSession(url, anonKey);
        if (!cancelled) setSignedIn(session);
      } catch {
        if (!cancelled) setSignedIn(false);
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url, anonKey]);

  if (checking) {
    return (
      <SafeAreaView style={styles.flex} edges={['top']}>
        <CommunityTopBar t={t} navigation={navigation} />
        <View style={styles.body}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!signedIn) {
    return (
      <SafeAreaView style={styles.flex} edges={['top']}>
        <CommunityTopBar t={t} navigation={navigation} />
        <AuthGate url={url} anonKey={anonKey} t={t} onSignedIn={() => setSignedIn(true)} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <CommunityTopBar t={t} navigation={navigation} />
      <Feed url={url} anonKey={anonKey} t={t} onSignedOut={() => setSignedIn(false)} />
    </SafeAreaView>
  );
}

function AuthGate({
  url,
  anonKey,
  t,
  onSignedIn,
}: {
  url: string;
  anonKey: string;
  t: any;
  onSignedIn: () => void;
}) {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setBusy(true);
    try {
      if (mode === 'signUp') {
        await signUp(url, anonKey, email, password, username);
      } else {
        await signIn(url, anonKey, email, password);
      }
      onSignedIn();
    } catch (err) {
      Alert.alert(
        t.community.authErrorTitle,
        err instanceof CommunityError || err instanceof Error ? err.message : String(err)
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>
          {mode === 'signUp' ? t.community.signUpTitle : t.community.signInTitle}
        </Text>
        <View style={styles.card}>
          <TextInput
            style={styles.keyInput}
            placeholder={t.community.emailPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <TextInput
            style={styles.keyInput}
            placeholder={t.community.passwordPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          {mode === 'signUp' && (
            <>
              <TextInput
                style={styles.keyInput}
                placeholder={t.community.usernamePlaceholder}
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.hint}>{t.community.usernameHint}</Text>
            </>
          )}
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedDim]}
            onPress={handleSubmit}
            disabled={busy}
          >
            {busy ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {mode === 'signUp' ? t.community.signUpButton : t.community.signInButton}
              </Text>
            )}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressedDim]}
            onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
          >
            <Text style={styles.linkButtonText}>
              {mode === 'signUp' ? t.community.switchToSignIn : t.community.switchToSignUp}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Feed({
  url,
  anonKey,
  t,
  onSignedOut,
}: {
  url: string;
  anonKey: string;
  t: any;
  onSignedOut: () => void;
}) {
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [friends, setFriends] = useState<CommunityProfile[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [friendInput, setFriendInput] = useState('');
  const [addingFriend, setAddingFriend] = useState(false);
  const [caption, setCaption] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | undefined>();
  const [photoPreviewUri, setPhotoPreviewUri] = useState<string | undefined>();
  const [posting, setPosting] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [myProfile, myFriends, feed] = await Promise.all([
      getMyProfile(url, anonKey),
      listFriends(url, anonKey),
      listFeed(url, anonKey),
    ]);
    setProfile(myProfile);
    setFriends(myFriends);
    setPosts(feed);
  }, [url, anonKey]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  function handleSignOut() {
    Alert.alert(t.community.signOutConfirmTitle, t.community.signOutConfirmMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.community.signOutButton,
        style: 'destructive',
        onPress: async () => {
          await signOut(url, anonKey);
          onSignedOut();
        },
      },
    ]);
  }

  async function handleAddFriend() {
    if (!friendInput.trim()) return;
    setAddingFriend(true);
    try {
      await addFriendByUsername(url, anonKey, friendInput.trim());
      setFriendInput('');
      await load();
    } catch (err) {
      Alert.alert(
        t.community.addFriendFailedTitle,
        err instanceof CommunityError || err instanceof Error ? err.message : String(err)
      );
    } finally {
      setAddingFriend(false);
    }
  }

  async function handlePickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      base64: true,
      quality: 0.5,
    });
    if (result.canceled || !result.assets[0]?.base64) return;
    setPhotoBase64(result.assets[0].base64);
    setPhotoPreviewUri(result.assets[0].uri);
  }

  async function handlePost() {
    if (!caption.trim() && !photoBase64) return;
    setPosting(true);
    try {
      await createPost(url, anonKey, caption, photoBase64);
      setCaption('');
      setPhotoBase64(undefined);
      setPhotoPreviewUri(undefined);
      await load();
    } catch (err) {
      Alert.alert(
        t.community.postFailedTitle,
        err instanceof CommunityError || err instanceof Error ? err.message : String(err)
      );
    } finally {
      setPosting(false);
    }
  }

  async function handleToggleLike(post: CommunityPost) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === post.id
          ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
          : p
      )
    );
    try {
      await toggleLike(url, anonKey, post.id, post.likedByMe);
    } catch {
      await load();
    }
  }

  function handleDeletePost(post: CommunityPost) {
    Alert.alert(t.community.deletePostConfirmTitle, t.community.deletePostConfirmMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.community.delete,
        style: 'destructive',
        onPress: async () => {
          await deletePost(url, anonKey, post.id);
          await load();
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.body}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.feedContainer}
        ListHeaderComponent={
          <View style={styles.feedHeader}>
            <View style={styles.profileRow}>
              <Text style={styles.usernameText}>@{profile?.username ?? '...'}</Text>
              <Pressable onPress={handleSignOut} hitSlop={8}>
                <Text style={styles.linkButtonText}>{t.community.signOutButton}</Text>
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>{t.community.friendsSection}</Text>
            <View style={styles.friendRow}>
              <TextInput
                style={[styles.keyInput, styles.friendInput]}
                placeholder={t.community.addFriendPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={friendInput}
                onChangeText={setFriendInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={({ pressed }) => [styles.addFriendButton, pressed && styles.pressedDim]}
                onPress={handleAddFriend}
                disabled={addingFriend}
              >
                {addingFriend ? (
                  <ActivityIndicator color={colors.background} size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>{t.community.addFriendButton}</Text>
                )}
              </Pressable>
            </View>
            {friends.length > 0 && (
              <View style={styles.friendChipRow}>
                {friends.map((f) => (
                  <View key={f.id} style={styles.friendChip}>
                    <Text style={styles.friendChipText}>@{f.username}</Text>
                  </View>
                ))}
              </View>
            )}

            <Text style={styles.sectionLabel}>{t.community.composerPlaceholder}</Text>
            <View style={styles.card}>
              <TextInput
                style={styles.composerInput}
                placeholder={t.community.composerPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={caption}
                onChangeText={setCaption}
                multiline
              />
              {photoPreviewUri && (
                <View style={styles.photoPreviewWrap}>
                  <Image source={{ uri: photoPreviewUri }} style={styles.photoPreview} />
                  <Pressable
                    style={({ pressed }) => [
                      styles.removePhotoButton,
                      pressed && styles.pressedDim,
                    ]}
                    onPress={() => {
                      setPhotoBase64(undefined);
                      setPhotoPreviewUri(undefined);
                    }}
                  >
                    <Text style={styles.removePhotoButtonText}>{t.community.removePhoto}</Text>
                  </Pressable>
                </View>
              )}
              <View style={styles.composerActions}>
                <Pressable
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedDim]}
                  onPress={handlePickPhoto}
                >
                  <Text style={styles.secondaryButtonText}>{t.community.addPhoto}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedDim]}
                  onPress={handlePost}
                  disabled={posting || (!caption.trim() && !photoBase64)}
                >
                  {posting ? (
                    <ActivityIndicator color={colors.background} size="small" />
                  ) : (
                    <Text style={styles.primaryButtonText}>{t.community.postButton}</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.body}>
            <Text style={styles.heading}>{t.community.feedEmptyTitle}</Text>
            <Text style={styles.copy}>{t.community.feedEmptyCopy}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            t={t}
            isMine={item.authorId === profile?.id}
            expanded={expandedPostId === item.id}
            onToggleExpand={() =>
              setExpandedPostId(expandedPostId === item.id ? null : item.id)
            }
            onToggleLike={() => handleToggleLike(item)}
            onDelete={() => handleDeletePost(item)}
            url={url}
            anonKey={anonKey}
          />
        )}
      />
    </KeyboardAvoidingView>
  );
}

function PostCard({
  post,
  t,
  isMine,
  expanded,
  onToggleExpand,
  onToggleLike,
  onDelete,
  url,
  anonKey,
}: {
  post: CommunityPost;
  t: any;
  isMine: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onToggleLike: () => void;
  onDelete: () => void;
  url: string;
  anonKey: string;
}) {
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentInput, setCommentInput] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    setLoadingComments(true);
    listComments(url, anonKey, post.id)
      .then(setComments)
      .finally(() => setLoadingComments(false));
  }, [expanded, url, anonKey, post.id]);

  async function handleSendComment() {
    if (!commentInput.trim()) return;
    setSendingComment(true);
    try {
      await addComment(url, anonKey, post.id, commentInput);
      setCommentInput('');
      const fresh = await listComments(url, anonKey, post.id);
      setComments(fresh);
    } catch (err) {
      Alert.alert('', err instanceof Error ? err.message : String(err));
    } finally {
      setSendingComment(false);
    }
  }

  return (
    <View style={styles.postCard}>
      <View style={styles.postHeader}>
        <Text style={styles.postAuthor}>@{post.authorUsername}</Text>
        <Text style={styles.postTimestamp}>{formatTimestamp(post.createdAt)}</Text>
      </View>
      {post.photoUrl && <Image source={{ uri: post.photoUrl }} style={styles.postPhoto} />}
      {!!post.caption && <Text style={styles.postCaption}>{post.caption}</Text>}
      <View style={styles.postActions}>
        <Pressable
          style={({ pressed }) => [styles.postActionButton, pressed && styles.pressedDim]}
          onPress={onToggleLike}
        >
          <Text style={styles.postActionText}>
            {post.likedByMe ? '❤️' : '🤍'} {post.likeCount}
          </Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.postActionButton, pressed && styles.pressedDim]}
          onPress={onToggleExpand}
        >
          <Text style={styles.postActionText}>💬 {post.commentCount}</Text>
        </Pressable>
        {isMine && (
          <Pressable
            style={({ pressed }) => [styles.postActionButton, pressed && styles.pressedDim]}
            onPress={onDelete}
          >
            <Text style={styles.postActionTextDanger}>🗑️</Text>
          </Pressable>
        )}
      </View>
      {expanded && (
        <View style={styles.commentsWrap}>
          <Text style={styles.sectionLabel}>{t.community.commentsTitle}</Text>
          {loadingComments ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : (
            comments.map((c) => (
              <View key={c.id} style={styles.commentRow}>
                <Text style={styles.commentAuthor}>@{c.authorUsername}</Text>
                <Text style={styles.commentBody}>{c.body}</Text>
              </View>
            ))
          )}
          <View style={styles.commentInputRow}>
            <TextInput
              style={[styles.keyInput, styles.commentInput]}
              placeholder={t.community.addCommentPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={commentInput}
              onChangeText={setCommentInput}
            />
            <Pressable
              style={({ pressed }) => [styles.addFriendButton, pressed && styles.pressedDim]}
              onPress={handleSendComment}
              disabled={sendingComment}
            >
              {sendingComment ? (
                <ActivityIndicator color={colors.background} size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>{t.community.postButton}</Text>
              )}
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pressedDim: { opacity: 0.6 },
  flex: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heading: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  copy: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  authContainer: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  keyInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
  },
  hint: { color: colors.textMuted, fontSize: 12 },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  primaryButtonText: { color: colors.background, fontWeight: '700' },
  secondaryButton: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    flex: 1,
  },
  secondaryButtonText: { color: colors.text, fontWeight: '700' },
  linkButton: { alignItems: 'center', paddingTop: spacing.xs },
  linkButtonText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  feedContainer: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.md },
  feedHeader: { gap: spacing.sm, marginBottom: spacing.sm },
  profileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  usernameText: { color: colors.text, fontSize: 18, fontWeight: '700' },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  friendRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  friendInput: { flex: 1 },
  addFriendButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  friendChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  friendChip: {
    backgroundColor: colors.primaryMuted,
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  friendChipText: { color: colors.primaryDark, fontWeight: '600', fontSize: 13 },
  composerInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  composerActions: { flexDirection: 'row', gap: spacing.sm },
  photoPreviewWrap: { position: 'relative' },
  photoPreview: { width: '100%', height: 160, borderRadius: radius.md },
  removePhotoButton: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: radius.full,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  removePhotoButtonText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  postAuthor: { color: colors.text, fontWeight: '700', fontSize: 14 },
  postTimestamp: { color: colors.textMuted, fontSize: 12 },
  postPhoto: { width: '100%', height: 220, borderRadius: radius.md },
  postCaption: { color: colors.text, fontSize: 14, lineHeight: 20 },
  postActions: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  postActionButton: { paddingVertical: spacing.xs },
  postActionText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
  postActionTextDanger: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  commentsWrap: { gap: spacing.xs, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm },
  commentRow: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  commentAuthor: { color: colors.text, fontWeight: '700', fontSize: 13 },
  commentBody: { color: colors.text, fontSize: 13 },
  commentInputRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  commentInput: { flex: 1 },
});
