import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
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
import {
  CameraIcon,
  ChevronIcon,
  CommentIcon,
  FlameIcon,
  HeartIcon,
  PlusIcon,
} from '../components/CommunityIcons';
import { GradientCard, SHADED_GRADIENT } from '../components/GradientCard';
import { CommunityIcon, SettingsIcon } from '../components/NavIcons';
import { useApp } from '../context/AppContext';
import { useWeekDays } from '../hooks/useWeekDays';
import {
  addComment,
  addFriendByUsername,
  CommunityError,
  createMyProfile,
  createPost,
  deletePost,
  getMyProfile,
  hasSession,
  listComments,
  listFeed,
  listFriends,
  saveMyWeekStats,
  signIn,
  signOut,
  signUp,
  toggleLike,
} from '../lib/community';
import { CommunityScreenNavigationProp, MainTabParamList } from '../navigation/types';
import { currentWeekDates, HIT_SCORE, WeekDayScore, weekSummary } from '../lib/weekScore';
import { getDayLogs, getHiddenPostIds, saveHiddenPostIds, todayIso } from '../storage/db';
import { colors, radius, spacing } from '../theme';
import { CommunityComment, CommunityPost, CommunityProfile, DayLog, FoodEntry, PostNutrition } from '../types';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const AVATAR_COLORS = ['#437157', '#C2703D', '#4F6FA8', '#8A5A9E', '#2E8B85', '#B5566B'];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name) },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.36 }]}>
        {name.slice(0, 2).toUpperCase()}
      </Text>
    </View>
  );
}

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return formatTimestamp(iso);
}

function NutritionChips({ n, overlay }: { n: PostNutrition; overlay?: boolean }) {
  return (
    <View style={[styles.chipRow, overlay && styles.chipRowOverlay]}>
      <View style={[styles.chip, { backgroundColor: 'rgba(17,24,39,0.72)' }]}>
        <Text style={styles.chipText}>{n.calories} kcal</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: colors.protein }]}>
        <Text style={styles.chipText}>P {n.proteinG}g</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: colors.carbs }]}>
        <Text style={styles.chipText}>C {n.carbsG}g</Text>
      </View>
      <View style={[styles.chip, { backgroundColor: colors.fat }]}>
        <Text style={styles.chipText}>F {n.fatG}g</Text>
      </View>
    </View>
  );
}

function entryNutrition(e: FoodEntry): PostNutrition {
  return { calories: e.calories, proteinG: e.proteinG, carbsG: e.carbsG, fatG: e.fatG };
}

export function CommunityScreen() {
  const navigation = useNavigation<CommunityScreenNavigationProp>();
  const route = useRoute<RouteProp<MainTabParamList, 'Community'>>();
  const { t, supabaseUrl, supabaseAnonKey } = useApp();
  const pendingFriendUsername = route.params?.pendingFriendUsername;

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
      pendingFriendUsername={pendingFriendUsername}
      onConsumedPendingFriend={() => navigation.setParams({ pendingFriendUsername: undefined })}
    />
  );
}

function CommunityTopBar({ t, navigation }: { t: any; navigation: CommunityScreenNavigationProp }) {
  return (
    <View style={styles.topBar}>
      <View style={styles.titleRow}>
        <CommunityIcon size={26} color={colors.accent} />
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
  pendingFriendUsername,
  onConsumedPendingFriend,
}: {
  url: string;
  anonKey: string;
  t: any;
  navigation: CommunityScreenNavigationProp;
  pendingFriendUsername?: string;
  onConsumedPendingFriend: () => void;
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
          <ActivityIndicator color={colors.accent} />
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
      <Feed
        url={url}
        anonKey={anonKey}
        t={t}
        onSignedOut={() => setSignedIn(false)}
        pendingFriendUsername={pendingFriendUsername}
        onConsumedPendingFriend={onConsumedPendingFriend}
      />
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
  pendingFriendUsername,
  onConsumedPendingFriend,
}: {
  url: string;
  anonKey: string;
  t: any;
  onSignedOut: () => void;
  pendingFriendUsername?: string;
  onConsumedPendingFriend: () => void;
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
  const [newUsername, setNewUsername] = useState('');
  const [savingUsername, setSavingUsername] = useState(false);
  const [attachedEntryId, setAttachedEntryId] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [composing, setComposing] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [weekLogs, setWeekLogs] = useState<DayLog[]>([]);
  const { today, plan } = useApp();
  const { days: weekDays } = useWeekDays(plan?.calorieTarget ?? 0, today.entries.length);

  useEffect(() => {
    getDayLogs(currentWeekDates()).then(setWeekLogs);
  }, [today.entries.length]);

  // A failed load (e.g. no signal) keeps what was on screen and shows a retry
  // card, rather than looking like you have no username.
  const load = useCallback(async () => {
    try {
      const [myProfile, myFriends, feed, hiddenIds] = await Promise.all([
        getMyProfile(url, anonKey),
        listFriends(url, anonKey),
        listFeed(url, anonKey),
        getHiddenPostIds(),
      ]);
      const hidden = new Set(hiddenIds);
      setProfile(myProfile);
      setFriends(myFriends);
      setPosts(feed.filter((p) => !hidden.has(p.id)));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [url, anonKey]);

  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);

  const consumingFriendRef = useRef<string | null>(null);

  useEffect(() => {
    if (loading || !pendingFriendUsername || !profile) return;
    if (consumingFriendRef.current === pendingFriendUsername) return;
    consumingFriendRef.current = pendingFriendUsername;
    if (pendingFriendUsername.toLowerCase() === profile.username.toLowerCase()) {
      onConsumedPendingFriend();
      return;
    }
    (async () => {
      try {
        await addFriendByUsername(url, anonKey, pendingFriendUsername);
        await load();
        Alert.alert(t.community.autoAddedTitle, `${t.community.autoAddedMsgPrefix} @${pendingFriendUsername}`);
      } catch (err) {
        Alert.alert(
          t.community.addFriendFailedTitle,
          err instanceof CommunityError || err instanceof Error ? err.message : String(err)
        );
      } finally {
        onConsumedPendingFriend();
      }
    })();
  }, [loading, pendingFriendUsername, profile, url, anonKey, load, onConsumedPendingFriend, t]);

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

  function handleInviteFriend() {
    const username = profile?.username;
    if (!username) return;
    const deepLink = `calorvault://add-friend/${encodeURIComponent(username)}`;
    const message = `${t.community.inviteMessagePrefix} @${username}${t.community.inviteMessageSuffix}\n${deepLink}`;
    const smsUrl = `sms:&body=${encodeURIComponent(message)}`;
    Linking.openURL(smsUrl).catch(() => {});
  }

  async function handleSaveUsername() {
    if (!newUsername.trim()) return;
    setSavingUsername(true);
    try {
      await createMyProfile(url, anonKey, newUsername);
      setNewUsername('');
      await load();
    } catch (err) {
      Alert.alert('', err instanceof Error ? err.message : String(err));
    } finally {
      setSavingUsername(false);
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
    if (!caption.trim() && !photoBase64 && !attachedEntryId) return;
    setPosting(true);
    try {
      const attached = today.entries.find((e) => e.id === attachedEntryId);
      await createPost(url, anonKey, caption, photoBase64, attached && entryNutrition(attached));
      setCaption('');
      setAttachedEntryId(null);
      setPhotoBase64(undefined);
      setPhotoPreviewUri(undefined);
      setComposing(false);
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

  // Your own posts are deleted for everyone. Other people's posts can't be
  // (the database only lets authors delete), so "Delete" hides them from
  // your feed on this device instead.
  function handleDeletePost(post: CommunityPost) {
    const isMine = post.authorId === profile?.id;
    const message = isMine
      ? t.community.deletePostConfirmMsg
      : `${t.community.hidePostMsgPrefix} @${post.authorUsername}.`;
    async function remove() {
      try {
        if (isMine) {
          await deletePost(url, anonKey, post.id);
        } else {
          const hidden = await getHiddenPostIds();
          await saveHiddenPostIds([...hidden, post.id]);
        }
        await load();
      } catch (err) {
        Alert.alert('', err instanceof Error ? err.message : String(err));
      }
    }
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t.common.cancel, t.community.delete],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
          message,
        },
        (index) => {
          if (index === 1) remove();
        }
      );
      return;
    }
    Alert.alert(t.community.deletePostConfirmTitle, message, [
      { text: t.common.cancel, style: 'cancel' },
      { text: t.community.delete, style: 'destructive', onPress: remove },
    ]);
  }

  const myName = profile?.username ?? '';
  const canPost = !!caption.trim() || !!photoBase64 || !!attachedEntryId;
  const showComposerExtras = composing || canPost;
  const streak = (() => {
    let count = 0;
    for (let i = weekDays.length - 1; i >= 0; i--) {
      if (weekDays[i].hasEntries) count++;
      else break;
    }
    return count;
  })();
  const week = useMemo(() => weekSummary(weekLogs, plan, todayIso()), [weekLogs, plan]);
  const weekStart = weekLogs[0]?.date ?? currentWeekDates()[0];

  // Share this week's score so friends can see where you rank.
  useEffect(() => {
    if (!profile) return;
    saveMyWeekStats(url, anonKey, { weekStart, weekScore: week.average, streak }).catch(() => {});
  }, [profile, url, anonKey, weekStart, week.average, streak]);

  if (loading) {
    return (
      <View style={styles.body}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // You plus the friends who've shared a score for this same week, best first.
  const ranked = [
    ...(profile && week.average !== null
      ? [{ id: profile.id, username: profile.username, score: week.average, streak, isMe: true }]
      : []),
    ...friends
      .filter((f) => f.weekStart === weekStart && f.weekScore != null)
      .map((f) => ({ id: f.id, username: f.username, score: f.weekScore as number, streak: f.streak ?? 0, isMe: false })),
  ].sort((a, b) => b.score - a.score);
  const myRank = ranked.findIndex((r) => r.isMe) + 1;
  const showRank = myRank > 0 && ranked.length > 1;
  const leader = ranked[0];
  const unranked = friends.filter((f) => !ranked.some((r) => r.id === f.id));

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        contentContainerStyle={styles.feedContainer}
        keyboardShouldPersistTaps="handled"
      >
        {loadFailed && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.community.loadFailed}</Text>
            <Pressable
              style={({ pressed }) => [styles.pillButton, styles.retryButton, pressed && styles.pressedDim]}
              onPress={handleRefresh}
            >
              <Text style={styles.pillButtonText}>{t.community.tryAgain}</Text>
            </Pressable>
          </View>
        )}

        {!profile && !loadFailed && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{t.community.chooseUsernameTitle}</Text>
            <Text style={styles.hint}>{t.community.chooseUsernameCopy}</Text>
            <View style={styles.friendRow}>
              <TextInput
                style={[styles.pillInput, styles.friendInput]}
                placeholder={t.community.usernamePlaceholder}
                placeholderTextColor={colors.textMuted}
                value={newUsername}
                onChangeText={setNewUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable
                style={({ pressed }) => [styles.pillButton, pressed && styles.pressedDim]}
                onPress={handleSaveUsername}
                disabled={savingUsername}
              >
                {savingUsername ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.pillButtonText}>{t.community.saveUsername}</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.scoreShadow}>
          <GradientCard style={styles.scoreCard} stops={SHADED_GRADIENT}>
            <View style={styles.scoreTopRow}>
              <Text style={styles.scoreEyebrow}>{t.community.thisWeek}</Text>
              <Text style={styles.scoreRange}>{weekRangeLabel()}</Text>
            </View>
            <View style={styles.scoreMain}>
              <View style={styles.scoreMainText}>
                <Text style={styles.scoreBig}>
                  {week.average !== null ? week.average : '–'}
                  {week.average !== null && <Text style={styles.scorePct}>%</Text>}
                </Text>
                <Text style={styles.scoreCaption}>
                  {week.average !== null ? t.community.weekScoreCaption : t.community.weekScoreEmpty}
                </Text>
              </View>
              <View style={styles.scoreBadgeWrap}>
                <View style={styles.scoreBadge}>
                  {showRank ? (
                    <Text style={styles.scoreBadgeText}>#{myRank}</Text>
                  ) : (
                    <View style={styles.scoreStreak}>
                      <Text style={styles.scoreBadgeText}>{streak}</Text>
                      <FlameIcon size={16} color={colors.accent} />
                    </View>
                  )}
                </View>
                <Text style={styles.scoreBadgeLabel}>
                  {showRank ? `${t.community.rankOf} ${ranked.length}` : t.community.dayStreak}
                </Text>
              </View>
            </View>
            <View style={styles.barsRow}>
              {week.days.map((d, i) => (
                <WeekBar key={d.date} day={d} index={i} />
              ))}
            </View>
            <View style={styles.scoreDivider} />
            <Pressable
              style={({ pressed }) => [styles.scoreFooter, pressed && styles.pressedDim]}
              onPress={friends.length > 0 ? () => setFriendsOpen(true) : handleInviteFriend}
            >
              {friends.length > 0 ? (
                <View style={styles.avatarStack}>
                  {friends.slice(0, 5).map((f, i) => (
                    <View key={f.id} style={[styles.stackItem, i > 0 && styles.stackOverlap]}>
                      <Avatar name={f.username} size={28} />
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.inviteDot}>
                  <PlusIcon size={14} color={colors.white} />
                </View>
              )}
              <Text style={styles.scoreFooterText} numberOfLines={1}>
                {friends.length === 0 ? (
                  t.community.inviteToCompete
                ) : showRank && leader ? (
                  leader.isMe ? (
                    <>
                      {t.community.youLead} <Text style={styles.scoreFooterStrong}>{leader.score}%</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.scoreFooterStrong}>{leader.username}</Text> {t.community.leadsWith}{' '}
                      {leader.score}%
                    </>
                  )
                ) : (
                  `${friends.length} ${t.community.friendsLabel}`
                )}
              </Text>
              <ChevronIcon size={14} color={colors.accent} />
            </Pressable>
          </GradientCard>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>{t.community.activity}</Text>
          <Pressable
            style={({ pressed }) => [styles.sectionLink, pressed && styles.pressedDim]}
            onPress={() => setFriendsOpen(true)}
            hitSlop={8}
          >
            <Text style={styles.sectionLinkText}>{t.community.friendsSection}</Text>
            <ChevronIcon size={12} color={colors.accent} />
          </Pressable>
        </View>

        <View style={styles.activityCard}>
          <View style={styles.composerRow}>
            <Avatar name={myName || '?'} size={42} />
            <TextInput
              style={styles.composerInput}
              placeholder={t.community.sharePlaceholder}
              placeholderTextColor={colors.textMuted}
              value={caption}
              onChangeText={setCaption}
              onFocus={() => setComposing(true)}
              multiline
            />
            <Pressable
              style={({ pressed }) => [styles.cameraButton, pressed && styles.pressedDim]}
              onPress={handlePickPhoto}
              accessibilityLabel={t.community.addPhoto}
            >
              <CameraIcon size={20} color={colors.white} />
            </Pressable>
          </View>
          {showComposerExtras && today.entries.length > 0 && (
            <View style={styles.attachBlock}>
              <Text style={styles.attachLabel}>{t.community.attachMeal}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.attachRow}
                keyboardShouldPersistTaps="handled"
              >
                {today.entries.map((e) => {
                  const active = e.id === attachedEntryId;
                  return (
                    <Pressable
                      key={e.id}
                      style={[styles.attachChip, active && styles.attachChipActive]}
                      onPress={() => {
                        setAttachedEntryId(active ? null : e.id);
                        if (!active && !caption.trim()) setCaption(e.foodName);
                      }}
                    >
                      <Text style={[styles.attachChipText, active && styles.attachChipTextActive]} numberOfLines={1}>
                        {e.foodName} · {Math.round(e.calories)} kcal
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
          {photoPreviewUri && (
            <View style={styles.photoPreviewWrap}>
              <Image source={{ uri: photoPreviewUri }} style={styles.photoPreview} />
              <Pressable
                style={({ pressed }) => [styles.removePhotoButton, pressed && styles.pressedDim]}
                onPress={() => {
                  setPhotoBase64(undefined);
                  setPhotoPreviewUri(undefined);
                }}
              >
                <Text style={styles.removePhotoButtonText}>{t.community.removePhoto}</Text>
              </Pressable>
            </View>
          )}
          {canPost && (
            <Pressable
              style={({ pressed }) => [styles.postButton, pressed && styles.pressedDim]}
              onPress={handlePost}
              disabled={posting}
            >
              {posting ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.pillButtonText}>{t.community.postButton}</Text>
              )}
            </Pressable>
          )}

          {posts.length === 0 ? (
            <View style={styles.activityEmpty}>
              <View style={styles.activityDivider} />
              <Text style={styles.activityEmptyText}>{t.community.noActivity}</Text>
              <Pressable
                style={({ pressed }) => [styles.invitePill, pressed && styles.pressedDim]}
                onPress={handleInviteFriend}
              >
                <PlusIcon size={14} color={colors.white} />
                <Text style={styles.invitePillText}>{t.community.invite}</Text>
              </Pressable>
            </View>
          ) : (
            posts.map((item) => (
              <View key={item.id}>
                <View style={styles.activityDivider} />
                <ActivityRow
                  post={item}
                  isMine={item.authorId === profile?.id}
                  t={t}
                  open={expandedPostId === item.id}
                  onToggle={() => setExpandedPostId(expandedPostId === item.id ? null : item.id)}
                  onToggleLike={() => handleToggleLike(item)}
                  onDelete={() => handleDeletePost(item)}
                  url={url}
                  anonKey={anonKey}
                />
              </View>
            ))
          )}
        </View>

        <View style={styles.footer}>
          {!!myName && (
            <Text style={styles.footerText}>
              {t.community.signedInAs} @{myName}
            </Text>
          )}
          <Pressable onPress={handleSignOut} hitSlop={8}>
            <Text style={styles.linkButtonText}>{t.community.signOutButton}</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal
        visible={friendsOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFriendsOpen(false)}
      >
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t.community.friendsSection}</Text>
            <Pressable onPress={() => setFriendsOpen(false)} hitSlop={10}>
              <Text style={styles.sheetDone}>{t.community.done}</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            <View style={styles.addFriendPill}>
              <TextInput
                style={styles.addFriendInput}
                placeholder={t.community.addFriendPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={friendInput}
                onChangeText={setFriendInput}
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={handleAddFriend}
                returnKeyType="done"
              />
              <Pressable
                style={({ pressed }) => [styles.pillButton, pressed && styles.pressedDim]}
                onPress={handleAddFriend}
                disabled={addingFriend || !friendInput.trim()}
              >
                {addingFriend ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.pillButtonText}>{t.community.addFriendButton}</Text>
                )}
              </Pressable>
            </View>

            {(ranked.length > 0 || unranked.length > 0) && (
              <View style={styles.rankCard}>
                {ranked.map((r, i) => (
                  <RankRow
                    key={r.id}
                    first={i === 0}
                    rank={i + 1}
                    name={r.isMe ? t.community.you : r.username}
                    avatarName={r.username}
                    score={r.score}
                    streak={r.streak}
                    isMe={r.isMe}
                    t={t}
                  />
                ))}
                {unranked.map((f, i) => (
                  <RankRow
                    key={f.id}
                    first={ranked.length === 0 && i === 0}
                    name={f.username}
                    avatarName={f.username}
                    streak={f.weekStart === weekStart ? f.streak ?? 0 : 0}
                    t={t}
                  />
                ))}
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.inviteWide, pressed && styles.pressedDim]}
              onPress={handleInviteFriend}
            >
              <PlusIcon size={16} color={colors.white} />
              <Text style={styles.inviteWideText}>{t.community.inviteFriendButton}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const BAR_MAX = 54;
// Monday 1 January 2024, used to get locale weekday initials in Monday-first order.
const REFERENCE_MONDAY = new Date(2024, 0, 1);

function weekRangeLabel(): string {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${fmt(monday)} – ${fmt(sunday)}`;
}

function WeekBar({ day, index }: { day: WeekDayScore; index: number }) {
  const labelDate = new Date(REFERENCE_MONDAY);
  labelDate.setDate(REFERENCE_MONDAY.getDate() + index);
  const label = labelDate.toLocaleDateString(undefined, { weekday: 'narrow' });
  const hit = day.score !== null && day.score >= HIT_SCORE;
  const height = day.score === null ? 4 : Math.max(8, (day.score / 100) * BAR_MAX);
  const color = day.score === null ? 'rgba(255,255,255,0.14)' : hit ? colors.accent : 'rgba(255,255,255,0.3)';
  return (
    <View style={styles.barCol}>
      <View style={styles.barTrack}>
        <View style={day.isToday && styles.barTodayRing}>
          <View style={[styles.bar, { height, backgroundColor: color }]} />
        </View>
      </View>
      <Text style={[styles.barLabel, day.isToday && styles.barLabelToday]}>{label}</Text>
    </View>
  );
}

function RankRow({
  first,
  rank,
  name,
  avatarName,
  score,
  streak,
  isMe,
  t,
}: {
  first: boolean;
  rank?: number;
  name: string;
  avatarName: string;
  score?: number;
  streak: number;
  isMe?: boolean;
  t: any;
}) {
  return (
    <View style={[styles.rankRow, !first && styles.rankRowBorder]}>
      <Text style={[styles.rankNumber, (rank === 1 || isMe) && styles.rankNumberHot]}>{rank ?? ''}</Text>
      <Avatar name={avatarName} size={38} />
      <View style={styles.rankText}>
        <Text style={[styles.rankName, isMe && styles.rankNameMe]} numberOfLines={1}>
          {name}
        </Text>
        {streak > 0 && (
          <View style={styles.rankMeta}>
            <FlameIcon size={11} color={colors.accent} />
            <Text style={styles.rankMetaText}>
              {streak} {t.community.dayStreak}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.rankScore}>
        {score !== undefined ? score : '–'}
        {score !== undefined && <Text style={styles.rankScorePct}>%</Text>}
      </Text>
    </View>
  );
}

function ActivityRow({
  post,
  isMine,
  t,
  open,
  onToggle,
  onToggleLike,
  onDelete,
  url,
  anonKey,
}: {
  post: CommunityPost;
  isMine: boolean;
  t: any;
  open: boolean;
  onToggle: () => void;
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
    if (!open) return;
    setLoadingComments(true);
    listComments(url, anonKey, post.id)
      .then(setComments)
      .finally(() => setLoadingComments(false));
  }, [open, url, anonKey, post.id]);

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

  const action = post.photoUrl || post.nutrition ? t.community.sharedAMeal : t.community.posted;
  // Time first so it never gets cut off by a long caption.
  const meta = [
    timeAgo(post.createdAt),
    post.caption.trim() || (post.nutrition ? `${post.nutrition.calories} kcal` : ''),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View>
      <Pressable style={({ pressed }) => [styles.actRow, pressed && styles.pressedDim]} onPress={onToggle}>
        <Avatar name={post.authorUsername} size={42} />
        <View style={styles.actText}>
          <Text style={styles.actTitle} numberOfLines={2}>
            <Text style={styles.actName}>{isMine ? t.community.you : post.authorUsername}</Text> {action}
          </Text>
          <Text style={styles.actMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        {post.photoUrl && !open && <Image source={{ uri: post.photoUrl }} style={styles.actThumb} />}
      </Pressable>
      {open && (
        <View style={styles.actOpen}>
          {post.photoUrl && (
            <View>
              <Image source={{ uri: post.photoUrl }} style={styles.actPhoto} />
              {post.nutrition && <NutritionChips n={post.nutrition} overlay />}
            </View>
          )}
          {!post.photoUrl && post.nutrition && <NutritionChips n={post.nutrition} />}
          {!!post.caption && <Text style={styles.postCaption}>{post.caption}</Text>}
          <View style={styles.postActions}>
            <Pressable
              style={({ pressed }) => [styles.postActionButton, pressed && styles.pressedDim]}
              onPress={onToggleLike}
              hitSlop={6}
            >
              <HeartIcon
                size={22}
                color={post.likedByMe ? colors.protein : colors.text}
                filled={post.likedByMe}
              />
              <Text style={styles.postActionText}>{post.likeCount}</Text>
            </Pressable>
            <View style={styles.postActionButton}>
              <CommentIcon size={22} color={colors.text} />
              <Text style={styles.postActionText}>{post.commentCount}</Text>
            </View>
            <View style={styles.flexSpacer} />
            <Pressable
              style={({ pressed }) => [styles.postMenuButton, pressed && styles.pressedDim]}
              onPress={onDelete}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t.community.delete}
            >
              <Text style={styles.postMenuDots}>•••</Text>
            </Pressable>
          </View>
          <View style={styles.commentsWrap}>
            {loadingComments ? (
              <ActivityIndicator color={colors.accent} size="small" />
            ) : (
              comments.map((c) => (
                <Text key={c.id} style={styles.commentBody}>
                  <Text style={styles.commentAuthor}>{c.authorUsername} </Text>
                  {c.body}
                </Text>
              ))
            )}
            <View style={[styles.addFriendPill, styles.commentPill]}>
              <TextInput
                style={styles.addFriendInput}
                placeholder={t.community.addCommentPlaceholder}
                placeholderTextColor={colors.textMuted}
                value={commentInput}
                onChangeText={setCommentInput}
              />
              <Pressable
                style={({ pressed }) => [styles.pillButton, pressed && styles.pressedDim]}
                onPress={handleSendComment}
                disabled={sendingComment || !commentInput.trim()}
              >
                {sendingComment ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.pillButtonText}>{t.community.postButton}</Text>
                )}
              </Pressable>
            </View>
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
    backgroundColor: colors.ink,
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
  linkButtonText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  feedContainer: { padding: spacing.lg, paddingBottom: spacing.xl * 3, gap: spacing.md },
  flexSpacer: { flex: 1 },
  retryButton: { alignSelf: 'flex-start' },
  scoreShadow: {
    borderRadius: 28,
    shadowColor: '#0B0F17',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  scoreCard: { borderRadius: 28, padding: 20 },
  scoreTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  scoreEyebrow: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  scoreRange: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '500' },
  scoreMain: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 10 },
  scoreMainText: { flex: 1 },
  scoreBig: { color: colors.white, fontSize: 64, fontWeight: '900', letterSpacing: -3, lineHeight: 68 },
  scorePct: { fontSize: 30, fontWeight: '800', letterSpacing: -1 },
  scoreCaption: { color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 4 },
  scoreBadgeWrap: { alignItems: 'center', gap: 5, marginBottom: 4 },
  scoreBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreBadgeText: { color: colors.white, fontSize: 22, fontWeight: '800' },
  scoreStreak: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  scoreBadgeLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11 },
  barsRow: { flexDirection: 'row', gap: 6, marginTop: 18 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barTrack: { height: 60, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 14, borderRadius: 7 },
  barTodayRing: { borderWidth: 1.5, borderColor: colors.white, borderRadius: 10, padding: 2 },
  barLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600' },
  barLabelToday: { color: colors.white, fontWeight: '800' },
  scoreDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginTop: 16, marginBottom: 14 },
  scoreFooter: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatarStack: { flexDirection: 'row' },
  stackItem: { borderWidth: 2.5, borderColor: '#1E2735', borderRadius: 17 },
  stackOverlap: { marginLeft: -10 },
  inviteDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreFooterText: { flex: 1, color: 'rgba(255,255,255,0.75)', fontSize: 13 },
  scoreFooterStrong: { color: colors.white, fontWeight: '700' },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  sectionLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionLinkText: { color: colors.accent, fontSize: 14, fontWeight: '700' },
  activityCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: spacing.md,
    paddingTop: 14,
    paddingBottom: 4,
    gap: 10,
    shadowColor: '#111827',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  activityDivider: { height: 1, backgroundColor: colors.border },
  activityEmpty: { gap: 12, paddingBottom: 14, alignItems: 'center' },
  activityEmptyText: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 4 },
  invitePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  invitePillText: { color: colors.white, fontWeight: '800', fontSize: 14 },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  actText: { flex: 1, minWidth: 0 },
  actTitle: { color: colors.text, fontSize: 14.5, lineHeight: 20 },
  actName: { fontWeight: '800' },
  actMeta: { color: colors.textMuted, fontSize: 12.5, marginTop: 3 },
  actThumb: { width: 56, height: 56, borderRadius: 14, backgroundColor: colors.surfaceAlt },
  actOpen: { gap: 10, paddingBottom: 14 },
  actPhoto: { width: '100%', aspectRatio: 1, borderRadius: 18, backgroundColor: colors.surfaceAlt },
  sheet: { flex: 1, backgroundColor: colors.background },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sheetTitle: { color: colors.text, fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  sheetDone: { color: colors.accent, fontSize: 16, fontWeight: '700' },
  sheetBody: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  rankCard: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    shadowColor: '#111827',
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rankRowBorder: { borderTopWidth: 1, borderTopColor: colors.border },
  rankNumber: { width: 18, color: '#9CA3AF', fontSize: 14, fontWeight: '800' },
  rankNumberHot: { color: colors.accent },
  rankText: { flex: 1, minWidth: 0 },
  rankName: { color: colors.text, fontSize: 15, fontWeight: '600' },
  rankNameMe: { color: colors.accent, fontWeight: '800' },
  rankMeta: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  rankMetaText: { color: colors.textMuted, fontSize: 12 },
  rankScore: { color: colors.text, fontSize: 17, fontWeight: '800', letterSpacing: -0.4 },
  rankScorePct: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  inviteWide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingVertical: 15,
  },
  inviteWideText: { color: colors.white, fontSize: 15, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipRowOverlay: { position: 'absolute', left: 10, bottom: 10, right: 10 },
  chip: { borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4 },
  chipText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  attachBlock: { gap: 6 },
  attachLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  attachRow: { gap: 6 },
  attachChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 7,
    maxWidth: 240,
  },
  attachChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  attachChipText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  attachChipTextActive: { color: colors.white },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  friendRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  friendInput: { flex: 1 },
  pillInput: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  pillButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.full,
    paddingHorizontal: 18,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  pillButtonLarge: {
    backgroundColor: colors.ink,
    borderRadius: radius.full,
    paddingHorizontal: 22,
    paddingVertical: 13,
    marginTop: spacing.sm,
  },
  pillButtonText: { color: colors.white, fontWeight: '700', fontSize: 15 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.white, fontWeight: '800' },
  addFriendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingLeft: spacing.md,
    padding: 5,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  commentPill: { backgroundColor: colors.surfaceAlt, shadowOpacity: 0, elevation: 0 },
  addFriendInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 8 },
  composerCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 12,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  composerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  composerInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    color: colors.text,
    fontSize: 15,
    maxHeight: 120,
  },
  cameraButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  postButton: {
    alignSelf: 'flex-end',
    backgroundColor: colors.ink,
    borderRadius: radius.full,
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
  photoPreviewWrap: { position: 'relative' },
  photoPreview: { width: '100%', height: 200, borderRadius: radius.md },
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  footer: { alignItems: 'center', gap: 6, paddingTop: spacing.lg },
  footerText: { color: colors.textMuted, fontSize: 12 },
  postMenuButton: { paddingHorizontal: spacing.xs, paddingVertical: 2 },
  postMenuDots: { color: colors.textMuted, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  postActions: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  postActionButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postActionText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  postCaption: { color: colors.text, fontSize: 14, lineHeight: 20 },
  commentsWrap: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  commentAuthor: { fontWeight: '700' },
  commentBody: { color: colors.text, fontSize: 14, lineHeight: 19 },
});
