import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';
import { LogoScanFrame } from '../components/FlameLogo';
import { IconBadge } from '../components/IconBadge';
import { MicIcon, PlanDayIcon, SearchIcon } from '../components/NavIcons';
import { useApp } from '../context/AppContext';
import { getCurrentOffering, PurchasesCancelledError } from '../lib/purchases';
import { formatPrice, yearlySavingsPercent } from '../lib/pricing';
import { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';
import { SubscriptionPlan } from '../types';

const PERK_BADGE_SIZE = 36;


// Scan logo, mic, plan-my-day cutlery for AI meal suggestions, and search
// for nutrition look-up.
const PERK_ICONS: React.ReactNode[] = [
  <LogoScanFrame key="scan" size={PERK_BADGE_SIZE} glyphScale={0.38} />,
  <IconBadge key="voice" Icon={MicIcon} size={PERK_BADGE_SIZE} />,
  <IconBadge key="meals" Icon={PlanDayIcon} size={PERK_BADGE_SIZE} />,
  <IconBadge key="search" Icon={SearchIcon} size={PERK_BADGE_SIZE} />,
];

export function PaywallScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { purchasePremium, restorePremium, purchasesSupported, t } = useApp();
  const [selected, setSelected] = useState<SubscriptionPlan>('yearly');
  const [subscribing, setSubscribing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const savings = yearlySavingsPercent();
  const perks = t.paywall.perks.map((text, i) => ({ icon: PERK_ICONS[i], text }));

  useEffect(() => {
    if (!purchasesSupported) return;
    getCurrentOffering()
      .then(setOffering)
      .catch(() => setOffering(null));
  }, [purchasesSupported]);

  const packages: Record<SubscriptionPlan, PurchasesPackage | null> = {
    monthly: offering?.monthly ?? null,
    yearly: offering?.annual ?? null,
  };
  const live = purchasesSupported && packages[selected] !== null;

  function displayPrice(plan: SubscriptionPlan): string {
    return packages[plan]?.product.priceString ?? formatPrice(plan);
  }

  async function handleSubscribe() {
    const pkg = packages[selected];
    if (!pkg) {
      Alert.alert(t.paywall.notAvailableTitle, t.paywall.notAvailableMsg);
      return;
    }
    setSubscribing(true);
    try {
      await purchasePremium(pkg, selected);
      navigation.goBack();
    } catch (err) {
      if (!(err instanceof PurchasesCancelledError)) {
        Alert.alert(t.paywall.purchaseFailedTitle, err instanceof Error ? err.message : String(err));
      }
    } finally {
      setSubscribing(false);
    }
  }

  async function handleRestore() {
    setRestoring(true);
    try {
      const found = await restorePremium();
      if (found) {
        navigation.goBack();
      } else {
        Alert.alert(t.paywall.restoreFailedTitle, t.paywall.noPurchasesFoundMsg);
      }
    } catch (err) {
      Alert.alert(t.paywall.restoreFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setRestoring(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{t.paywall.title}</Text>
      <Text style={styles.subtitle}>{t.paywall.subtitle}</Text>

      <View style={styles.perksCard}>
        {perks.map((perk) => (
          <View key={perk.text} style={styles.perkRow}>
            {perk.icon}
            <Text style={styles.perkText}>{perk.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.plansRow}>
        <Pressable
          style={({ pressed }) => [
            styles.planCard,
            selected === 'monthly' && styles.planCardSelected,
            pressed && styles.pressedDim,
          ]}
          onPress={() => setSelected('monthly')}
        >
          <Text style={styles.planLabel}>{t.paywall.monthly}</Text>
          <Text style={styles.planPrice}>{displayPrice('monthly')}</Text>
          <Text style={styles.planUnit}>{t.paywall.perMonth}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.planCard,
            selected === 'yearly' && styles.planCardSelected,
            pressed && styles.pressedDim,
          ]}
          onPress={() => setSelected('yearly')}
        >
          {savings > 0 && (
            <View style={styles.saveBadge}>
              <Text style={styles.saveBadgeText}>{t.paywall.save} {savings}%</Text>
            </View>
          )}
          <Text style={styles.planLabel}>{t.paywall.yearly}</Text>
          <Text style={styles.planPrice}>{displayPrice('yearly')}</Text>
          <Text style={styles.planUnit}>{t.paywall.perYear}</Text>
        </Pressable>
      </View>

      <Pressable
        style={({ pressed }) => [styles.subscribeButton, pressed && styles.pressedDim]}
        onPress={handleSubscribe}
        disabled={subscribing}
      >
        {subscribing ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.subscribeText}>
            {t.paywall.subscribe} · {displayPrice(selected)}
            {selected === 'monthly' ? '/mo' : '/yr'}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={handleRestore}
        style={({ pressed }) => [styles.skipButton, pressed && styles.pressedDim]}
        disabled={restoring}
      >
        {restoring ? (
          <ActivityIndicator color={colors.textMuted} size="small" />
        ) : (
          <Text style={styles.skipText}>{t.paywall.restorePurchases}</Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => navigation.goBack()}
        style={({ pressed }) => [styles.skipButton, pressed && styles.pressedDim]}
      >
        <Text style={styles.skipText}>{t.paywall.notNow}</Text>
      </Pressable>

      <Text style={styles.disclaimer}>
        {live ? t.paywall.disclaimerLive : t.paywall.disclaimerUnavailable}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pressedDim: { opacity: 0.6 },
  container: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
  perksCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  perkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  perkText: { color: colors.text, fontSize: 14, fontWeight: '500', flex: 1 },
  plansRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  planCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 2,
  },
  planCardSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentMuted,
  },
  saveBadge: {
    position: 'absolute',
    top: -10,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  saveBadgeText: {
    color: colors.background,
    fontSize: 11,
    fontWeight: '700',
  },
  planLabel: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  planPrice: { color: colors.text, fontSize: 24, fontWeight: '800', marginTop: spacing.xs },
  planUnit: { color: colors.textMuted, fontSize: 12 },
  subscribeButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  subscribeText: { color: colors.background, fontWeight: '700', fontSize: 16 },
  skipButton: { alignItems: 'center', padding: spacing.sm },
  skipText: { color: colors.textMuted, fontWeight: '600' },
  disclaimer: {
    color: colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
});
