import * as AppleAuthentication from 'expo-apple-authentication';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CommunityError,
  resetPasswordWithCode,
  sendPasswordResetCode,
  signIn,
  signInWithApple,
  signUp,
} from '../lib/community';
import { colors, radius, spacing } from '../theme';

// Sign in / sign up for a CalorVault account: Sign in with Apple, email and
// password, and resetting a forgotten password with an emailed code. Used on
// the welcome screen and in Community.
export function AuthForm({
  url,
  anonKey,
  t,
  onSignedIn,
  initialMode = 'signIn',
  header,
  footer,
}: {
  url: string;
  anonKey: string;
  t: any;
  onSignedIn: () => void;
  initialMode?: 'signIn' | 'signUp';
  // Shown above the heading and below the form, inside the same scroll view.
  header?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const [mode, setMode] = useState<'signIn' | 'signUp' | 'forgot'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync()
      .then(setAppleAvailable)
      .catch(() => setAppleAvailable(false));
  }, []);

  function showError(title: string, err: unknown) {
    Alert.alert(title, err instanceof CommunityError || err instanceof Error ? err.message : String(err));
  }

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
      showError(t.community.authErrorTitle, err);
    } finally {
      setBusy(false);
    }
  }

  async function handleApple() {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      if (!credential.identityToken) throw new CommunityError(t.community.appleFailed);
      setBusy(true);
      await signInWithApple(url, anonKey, credential.identityToken);
      onSignedIn();
    } catch (err) {
      if ((err as { code?: string }).code === 'ERR_REQUEST_CANCELED') return;
      showError(t.community.authErrorTitle, err);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendCode() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await sendPasswordResetCode(url, anonKey, email);
      setCodeSent(true);
    } catch (err) {
      showError(t.community.resetFailedTitle, err);
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword() {
    if (!code.trim() || !password) return;
    setBusy(true);
    try {
      await resetPasswordWithCode(url, anonKey, email, code, password);
      onSignedIn();
    } catch (err) {
      showError(t.community.resetFailedTitle, err);
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: 'signIn' | 'signUp' | 'forgot') {
    setMode(next);
    setPassword('');
    setCode('');
    setCodeSent(false);
  }

  function submitButton(label: string, onPress: () => void) {
    return (
      <Pressable
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressedDim]}
        onPress={onPress}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.primaryButtonText}>{label}</Text>
        )}
      </Pressable>
    );
  }

  const emailInput = (
    <TextInput
      style={styles.keyInput}
      placeholder={t.community.emailPlaceholder}
      placeholderTextColor={colors.textMuted}
      value={email}
      onChangeText={setEmail}
      autoCapitalize="none"
      autoCorrect={false}
      keyboardType="email-address"
      textContentType="emailAddress"
      editable={!codeSent}
    />
  );

  if (mode === 'forgot') {
    return (
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
          {header}
          <Text style={styles.heading}>{t.community.resetTitle}</Text>
          <Text style={styles.copy}>
            {codeSent ? `${t.community.codeSentCopy} ${email.trim()}` : t.community.resetCopy}
          </Text>
          <View style={styles.card}>
            {emailInput}
            {codeSent ? (
              <>
                <TextInput
                  style={styles.keyInput}
                  placeholder={t.community.codePlaceholder}
                  placeholderTextColor={colors.textMuted}
                  value={code}
                  onChangeText={setCode}
                  keyboardType="number-pad"
                  textContentType="oneTimeCode"
                  autoComplete="one-time-code"
                  maxLength={10}
                />
                <TextInput
                  style={styles.keyInput}
                  placeholder={t.community.newPasswordPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  textContentType="newPassword"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {submitButton(t.community.resetButton, handleResetPassword)}
              </>
            ) : (
              submitButton(t.community.sendCode, handleSendCode)
            )}
            <Pressable
              style={({ pressed }) => [styles.linkButton, pressed && styles.pressedDim]}
              onPress={() => switchMode('signIn')}
            >
              <Text style={styles.linkButtonText}>{t.community.backToSignIn}</Text>
            </Pressable>
          </View>
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.authContainer} keyboardShouldPersistTaps="handled">
        {header}
        <Text style={styles.heading}>
          {mode === 'signUp' ? t.community.signUpTitle : t.community.signInTitle}
        </Text>
        {appleAvailable && (
          <>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.md}
              style={styles.appleButton}
              onPress={handleApple}
            />
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>{t.community.orDivider}</Text>
              <View style={styles.orLine} />
            </View>
          </>
        )}
        <View style={styles.card}>
          {emailInput}
          <TextInput
            style={styles.keyInput}
            placeholder={t.community.passwordPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType={mode === 'signUp' ? 'newPassword' : 'password'}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {mode === 'signIn' && (
            <Pressable
              style={({ pressed }) => [styles.forgotLink, pressed && styles.pressedDim]}
              onPress={() => switchMode('forgot')}
              hitSlop={6}
            >
              <Text style={styles.forgotLinkText}>{t.community.forgotPassword}</Text>
            </Pressable>
          )}
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
          {submitButton(
            mode === 'signUp' ? t.community.signUpButton : t.community.signInButton,
            handleSubmit
          )}
          <Pressable
            style={({ pressed }) => [styles.linkButton, pressed && styles.pressedDim]}
            onPress={() => switchMode(mode === 'signUp' ? 'signIn' : 'signUp')}
          >
            <Text style={styles.linkButtonText}>
              {mode === 'signUp' ? t.community.switchToSignIn : t.community.switchToSignUp}
            </Text>
          </Pressable>
        </View>
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  authContainer: {
    padding: spacing.lg,
    gap: spacing.md,
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
  linkButton: { alignItems: 'center', paddingTop: spacing.xs },
  linkButtonText: { color: colors.accent, fontWeight: '600', fontSize: 13 },
  pressedDim: { opacity: 0.6 },
  appleButton: { height: 50, width: '100%' },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  orLine: { flex: 1, height: 1, backgroundColor: colors.border },
  orText: { color: colors.textMuted, fontSize: 13 },
  forgotLink: { alignSelf: 'flex-end' },
  forgotLinkText: { color: colors.textMuted, fontWeight: '600', fontSize: 13 },
});
