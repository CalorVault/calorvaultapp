import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthForm } from '../components/AuthForm';
import { LogoScanFrame } from '../components/FlameLogo';
import { useApp } from '../context/AppContext';
import { hasSession } from '../lib/community';
import { colors, spacing } from '../theme';

// Shown once before setup on a new install: create an account (Apple or
// email) or skip. The account is what Community uses, and nothing else needs
// it, so skipping is always allowed.
export function WelcomeScreen({ onDone }: { onDone: () => void }) {
  const { t, supabaseUrl, supabaseAnonKey } = useApp();
  const hasBackend = !!supabaseUrl && !!supabaseAnonKey;

  // Nothing to sign in to without a backend, and no need to ask again if
  // already signed in (e.g. the app was closed part-way through setup).
  useEffect(() => {
    if (!hasBackend) {
      onDone();
      return;
    }
    hasSession(supabaseUrl, supabaseAnonKey)
      .then((signedIn) => {
        if (signedIn) onDone();
      })
      .catch(() => {});
  }, [hasBackend, supabaseUrl, supabaseAnonKey, onDone]);

  if (!hasBackend) return null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <AuthForm
        url={supabaseUrl}
        anonKey={supabaseAnonKey}
        t={t}
        initialMode="signUp"
        onSignedIn={onDone}
        header={
          <View style={styles.brand}>
            <LogoScanFrame size={72} />
            <View style={styles.wordmarkRow}>
              <Text style={[styles.wordmark, styles.wordmarkCalor]}>Calor</Text>
              <Text style={[styles.wordmark, styles.wordmarkVault]}>Vault</Text>
            </View>
            <Text style={styles.tagline}>{t.onboarding.accountTagline}</Text>
          </View>
        }
        footer={
          <Pressable
            style={({ pressed }) => [styles.skip, pressed && styles.pressedDim]}
            onPress={onDone}
            hitSlop={8}
          >
            <Text style={styles.skipText}>{t.onboarding.skipForNow}</Text>
          </Pressable>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  brand: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  wordmarkRow: { flexDirection: 'row', marginTop: spacing.xs },
  wordmark: { fontSize: 30, fontWeight: '800' },
  wordmarkCalor: { color: colors.ink },
  wordmarkVault: { color: colors.accent },
  tagline: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  skip: { alignSelf: 'center', paddingVertical: spacing.sm },
  skipText: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  pressedDim: { opacity: 0.6 },
});
