import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
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
import Svg, { Circle } from 'react-native-svg';
import { CameraIcon, CommentIcon, HeartIcon, PlusIcon } from '../components/CommunityIcons';
import { BLACK_GRADIENT, GradientCard } from '../components/GradientCard';
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
  signIn,
  signOut,
  signUp,
  toggleLike,
} from '../lib/community';
import { CommunityScreenNavigationProp, MainTabParamList } from '../navigation/types';
import { getHiddenPostIds, saveHiddenPostIds } from '../storage/db';
import { colors, radius, spacing } from '../theme';
import { CommunityComment, CommunityPost, CommunityProfile, FoodEntry, PostNutrition } from '../types';

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

function ProgressRing({
  percent,
  color,
  label,
}: {
  percent: number;
  color: string;
  label: string;
}) {
  const size = 52;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(percent, 100));
  return (
    <View style={styles.ringWrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.18)" strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - clamped / 100)}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={styles.ringPercent}>{Math.round(percent)}%</Text>
        </View>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
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
  const { today, plan } = useApp();
  const { days: weekDays } = useWeekDays(plan?.calorieTarget ?? 0, today.entries.length);

  const load = useCallback(async () => {
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

  if (loading) {
    return (
      <View style={styles.body}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // A friend's circle gets a green ring when they've posted in the last day.
  const postedToday = new Set(
    posts
      .filter((p) => Date.now() - new Date(p.createdAt).getTime() < 24 * 60 * 60 * 1000)
      .map((p) => p.authorId)
  );
  const myName = profile?.username ?? '';
  const canPost = !!caption.trim() || !!photoBase64 || !!attachedEntryId;
  const streak = (() => {
    let count = 0;
    for (let i = weekDays.length - 1; i >= 0; i--) {
      if (weekDays[i].hasEntries) count++;
      else break;
    }
    return count;
  })();
  const totals = today.entries.reduce(
    (acc, e) => ({
      calories: acc.calories + e.calories,
      proteinG: acc.proteinG + e.proteinG,
      carbsG: acc.carbsG + e.carbsG,
      fatG: acc.fatG + e.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }
  );
  const pct = (value: number, target?: number) => (target ? (value / target) * 100 : 0);

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
            {!profile && (
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

            <GradientCard style={styles.hero} stops={BLACK_GRADIENT}>
              <View style={styles.heroTop}>
                <View style={styles.heroAvatarRing}>
                  <Avatar name={myName || '?'} size={52} />
                </View>
                <View style={styles.heroText}>
                  <Text style={styles.heroName} numberOfLines={1}>
                    @{myName || '...'}
                  </Text>
                  <Text style={styles.heroMeta} numberOfLines={1}>
                    🔥 {streak} {t.community.dayStreak}
                  </Text>
                  <Text style={styles.heroMeta} numberOfLines={1}>
                    {friends.length} {t.community.friendsLabel}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.heroInvite, pressed && styles.pressedDim]}
                  onPress={handleInviteFriend}
                >
                  <PlusIcon size={14} color={colors.white} />
                  <Text style={styles.heroInviteText}>{t.community.invite}</Text>
                </Pressable>
              </View>
              <Text style={styles.heroSection}>{t.community.todaySoFar}</Text>
              <View style={styles.ringsRow}>
                <ProgressRing
                  percent={pct(totals.calories, plan?.calorieTarget)}
                  color={colors.white}
                  label={t.community.calories}
                />
                <ProgressRing
                  percent={pct(totals.proteinG, plan?.proteinG)}
                  color={colors.protein}
                  label={t.onboarding.protein}
                />
                <ProgressRing
                  percent={pct(totals.carbsG, plan?.carbsG)}
                  color={colors.carbs}
                  label={t.onboarding.carbs}
                />
                <ProgressRing
                  percent={pct(totals.fatG, plan?.fatG)}
                  color={colors.fat}
                  label={t.onboarding.fat}
                />
              </View>
            </GradientCard>

            {friends.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.storiesRow}
              >
                {friends.map((f) => (
                  <View key={f.id} style={styles.story}>
                    <View
                      style={[
                        styles.storyRing,
                        { borderColor: postedToday.has(f.id) ? colors.accent : colors.border },
                      ]}
                    >
                      <Avatar name={f.username} size={52} />
                    </View>
                    <Text style={styles.storyName} numberOfLines={1}>
                      {f.username}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            )}

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

            <View style={styles.composerCard}>
              <View style={styles.composerRow}>
                <Avatar name={myName || '?'} size={40} />
                <TextInput
                  style={styles.composerInput}
                  placeholder={t.community.sharePlaceholder}
                  placeholderTextColor={colors.textMuted}
                  value={caption}
                  onChangeText={setCaption}
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
              {today.entries.length > 0 && (
                <View style={styles.attachBlock}>
                  <Text style={styles.attachLabel}>{t.community.attachMeal}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachRow}>
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
                          <Text
                            style={[styles.attachChipText, active && styles.attachChipTextActive]}
                            numberOfLines={1}
                          >
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
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.iconWrap}>
              <CommunityIcon size={40} color={colors.accent} />
            </View>
            <Text style={styles.heading}>{t.community.feedEmptyTitle}</Text>
            <Text style={styles.copy}>{t.community.feedEmptyCopy}</Text>
            <Pressable
              style={({ pressed }) => [styles.pillButtonLarge, pressed && styles.pressedDim]}
              onPress={handleInviteFriend}
            >
              <Text style={styles.pillButtonText}>{t.community.inviteFriendButton}</Text>
            </Pressable>
          </View>
        }
        ListFooterComponent={
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
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            t={t}
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
  expanded,
  onToggleExpand,
  onToggleLike,
  onDelete,
  url,
  anonKey,
}: {
  post: CommunityPost;
  t: any;
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
        <Avatar name={post.authorUsername} size={36} />
        <View style={styles.postHeaderText}>
          <Text style={styles.postAuthor}>@{post.authorUsername}</Text>
          <Text style={styles.postTimestamp}>{timeAgo(post.createdAt)}</Text>
        </View>
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
      {post.photoUrl && (
        <View>
          <Image source={{ uri: post.photoUrl }} style={styles.postPhoto} />
          {post.nutrition && <NutritionChips n={post.nutrition} overlay />}
        </View>
      )}
      <View style={styles.postBody}>
        {!post.photoUrl && post.nutrition && <NutritionChips n={post.nutrition} />}
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
          <Pressable
            style={({ pressed }) => [styles.postActionButton, pressed && styles.pressedDim]}
            onPress={onToggleExpand}
            hitSlop={6}
          >
            <CommentIcon size={22} color={colors.text} />
            <Text style={styles.postActionText}>{post.commentCount}</Text>
          </Pressable>
        </View>
        {!!post.caption && (
          <Text style={styles.postCaption}>
            <Text style={styles.postCaptionAuthor}>{post.authorUsername} </Text>
            {post.caption}
          </Text>
        )}
        {expanded && (
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
        )}
      </View>
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
  feedHeader: { gap: spacing.md },
  hero: {
    borderRadius: 24,
    padding: spacing.md,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroAvatarRing: { padding: 2, borderRadius: 30, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  heroText: { flex: 1 },
  heroName: { color: colors.white, fontSize: 19, fontWeight: '800' },
  heroMeta: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginTop: 2 },
  heroInvite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  heroInviteText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  heroSection: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  ringsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  ringWrap: { alignItems: 'center', gap: 5, flex: 1 },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercent: { color: colors.white, fontSize: 12, fontWeight: '800' },
  ringLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 11.5 },
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
  storiesRow: { gap: 12, paddingVertical: 2 },
  story: { alignItems: 'center', width: 68, gap: 6 },
  storyRing: { padding: 2, borderRadius: 32, borderWidth: 2.5 },
  storyName: { color: colors.text, fontSize: 12, maxWidth: 68 },
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
    backgroundColor: colors.surfaceAlt,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    color: colors.text,
    fontSize: 15,
    maxHeight: 120,
  },
  cameraButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
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
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12 },
  postHeaderText: { flex: 1 },
  postMenuButton: { paddingHorizontal: spacing.xs, paddingVertical: 2 },
  postMenuDots: { color: colors.textMuted, fontSize: 14, fontWeight: '700', letterSpacing: 1 },
  postAuthor: { color: colors.text, fontWeight: '700', fontSize: 15 },
  postTimestamp: { color: colors.textMuted, fontSize: 12, marginTop: 1 },
  postPhoto: { width: '100%', aspectRatio: 1, backgroundColor: colors.surfaceAlt },
  postBody: { padding: 12, gap: 8 },
  postActions: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  postActionButton: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  postActionText: { color: colors.text, fontWeight: '600', fontSize: 14 },
  postCaption: { color: colors.text, fontSize: 14, lineHeight: 20 },
  postCaptionAuthor: { fontWeight: '700' },
  commentsWrap: { gap: 6, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  commentAuthor: { fontWeight: '700' },
  commentBody: { color: colors.text, fontSize: 14, lineHeight: 19 },
});
