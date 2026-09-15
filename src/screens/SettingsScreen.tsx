import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { LANGUAGES } from '../i18n';
import { exportBackup } from '../lib/dataExport';
import { formatPrice } from '../lib/pricing';
import { openManageSubscriptions } from '../lib/purchases';
import { applyReminderSettings } from '../lib/reminders';
import { RootStackParamList } from '../navigation/types';
import { clearAllData, getReminderSettings, saveReminderSettings } from '../storage/db';
import { colors, radius, spacing } from '../theme';
import { ActivityLevel, Goal, ReminderSettings } from '../types';

const REMINDER_TIME_PRESETS = ['08:00', '12:00', '18:00', '20:00'];

export function SettingsScreen() {
  const {
    profile,
    plan,
    apiKey,
    recipeApiKey,
    language,
    setLanguage,
    t,
    subscription,
    isPremium,
    updateProfile,
    setApiKey,
    setRecipeApiKey,
    restorePremium,
    waterTargetMl,
    setWaterTarget,
  } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [keyInput, setKeyInput] = useState(apiKey ?? '');
  const [recipeKeyInput, setRecipeKeyInput] = useState(recipeApiKey ?? '');
  const [waterTargetInput, setWaterTargetInput] = useState(String(waterTargetMl));
  const [exporting, setExporting] = useState(false);
  const [restoringPurchases, setRestoringPurchases] = useState(false);
  const [reminder, setReminder] = useState<ReminderSettings>({ enabled: false, time: '18:00' });
  const [savingReminder, setSavingReminder] = useState(false);

  useEffect(() => {
    getReminderSettings().then(setReminder);
  }, []);
  const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
    sedentary: t.onboarding.activityOptions.sedentary.label,
    light: t.onboarding.activityOptions.light.label,
    moderate: t.onboarding.activityOptions.moderate.label,
    active: t.onboarding.activityOptions.active.label,
    very_active: t.onboarding.activityOptions.veryActive.label,
  };
  const GOAL_LABELS: Record<Goal, string> = {
    lose: t.onboarding.goalOptions.lose.label,
    maintain: t.onboarding.goalOptions.maintain.label,
    gain: t.onboarding.goalOptions.gain.label,
    build_muscle: t.onboarding.goalOptions.buildMuscle.label,
  };
  const [weightKgInput, setWeightKgInput] = useState(
    profile ? String(profile.weightKg) : ''
  );
  const [heightCmInput, setHeightCmInput] = useState(
    profile ? String(profile.heightCm) : ''
  );

  if (!profile || !plan) return null;
  const p = profile;

  async function handleSaveKey() {
    await setApiKey(keyInput.trim());
    Alert.alert(t.settings.savedTitle, t.settings.savedApiKeyMsg);
  }

  async function handleSaveRecipeKey() {
    await setRecipeApiKey(recipeKeyInput.trim());
    Alert.alert(t.settings.savedTitle, t.settings.savedRecipeKeyMsg);
  }

  async function handleSaveWaterTarget() {
    const ml = parseInt(waterTargetInput, 10);
    if (Number.isNaN(ml) || ml <= 0) return;
    await setWaterTarget(ml);
    Alert.alert(t.settings.savedTitle, t.settings.waterTargetSavedMsg);
  }

  async function handleWeightUpdate() {
    const kg = parseFloat(weightKgInput);
    if (Number.isNaN(kg) || kg <= 0) return;
    await updateProfile({ ...p, weightKg: Math.round(kg * 10) / 10 });
    Alert.alert(t.settings.updatedTitle, t.settings.updatedMsg);
  }

  async function handleHeightUpdate() {
    const cm = parseFloat(heightCmInput);
    if (Number.isNaN(cm) || cm <= 0) return;
    await updateProfile({ ...p, heightCm: Math.round(cm) });
    Alert.alert(t.settings.updatedTitle, t.settings.updatedMsg);
  }

  async function cycleGoal() {
    const goals: Goal[] = ['lose', 'maintain', 'gain', 'build_muscle'];
    const next = goals[(goals.indexOf(p.goal) + 1) % goals.length];
    await updateProfile({ ...p, goal: next });
  }

  async function cycleActivity() {
    const levels: ActivityLevel[] = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
    const next = levels[(levels.indexOf(p.activityLevel) + 1) % levels.length];
    await updateProfile({ ...p, activityLevel: next });
  }

  function handleManageSubscription() {
    openManageSubscriptions().catch((err) => {
      Alert.alert(
        t.settings.manageSubscriptionFailedTitle,
        err instanceof Error ? err.message : String(err)
      );
    });
  }

  async function handleRestorePurchases() {
    setRestoringPurchases(true);
    try {
      const found = await restorePremium();
      if (!found) {
        Alert.alert(t.paywall.restoreFailedTitle, t.paywall.noPurchasesFoundMsg);
      }
    } catch (err) {
      Alert.alert(t.paywall.restoreFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setRestoringPurchases(false);
    }
  }

  async function applyAndSaveReminder(next: ReminderSettings) {
    setSavingReminder(true);
    try {
      await applyReminderSettings(next, {
        title: t.tracking.reminderNotificationTitle,
        body: t.tracking.reminderNotificationBody,
      });
      await saveReminderSettings(next);
      setReminder(next);
    } catch (err) {
      Alert.alert(
        t.settings.reminderNotSetTitle,
        err instanceof Error ? err.message : String(err)
      );
    } finally {
      setSavingReminder(false);
    }
  }

  function handleToggleReminder(enabled: boolean) {
    applyAndSaveReminder({ ...reminder, enabled });
  }

  function handleSelectReminderTime(time: string) {
    applyAndSaveReminder({ ...reminder, time });
  }

  async function handleExportData() {
    setExporting(true);
    try {
      await exportBackup();
    } catch (err) {
      Alert.alert(t.settings.exportFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setExporting(false);
    }
  }

  function handleResetData() {
    Alert.alert(t.settings.resetConfirmTitle, t.settings.resetConfirmMsg, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.settings.resetAction,
        style: 'destructive',
        onPress: async () => {
          await clearAllData();
          Alert.alert(t.settings.resetDoneTitle, t.settings.resetDoneMsg);
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t.settings.title}</Text>

        <Text style={styles.sectionLabel}>{t.settings.subscriptionSection}</Text>
        {isPremium ? (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t.settings.status}</Text>
              <Text style={styles.premiumBadge}>{t.settings.premiumBadge}</Text>
            </View>
            {subscription && (
              <Row
                label={t.settings.plan}
                value={
                  subscription.plan === 'monthly'
                    ? `${t.paywall.monthly} · ${formatPrice('monthly')}/mo`
                    : `${t.paywall.yearly} · ${formatPrice('yearly')}/yr`
                }
              />
            )}
            <Pressable
              style={({ pressed }) => [styles.cancelLink, pressed && styles.pressedDim]}
              onPress={handleManageSubscription}
            >
              <Text style={styles.cancelLinkText}>{t.settings.manageSubscription}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t.settings.status}</Text>
              <Text style={styles.rowValue}>{t.settings.freePlan}</Text>
            </View>
            <Text style={styles.hint}>{t.settings.upgradeCopy}</Text>
            <Pressable
              style={({ pressed }) => [styles.saveButton, pressed && styles.pressedDim]}
              onPress={() => navigation.navigate('Paywall')}
            >
              <Text style={styles.saveButtonText}>{t.settings.upgradeButton}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.cancelLink, pressed && styles.pressedDim]}
              onPress={handleRestorePurchases}
              disabled={restoringPurchases}
            >
              {restoringPurchases ? (
                <ActivityIndicator color={colors.textMuted} size="small" />
              ) : (
                <Text style={styles.cancelLinkText}>{t.paywall.restorePurchases}</Text>
              )}
            </Pressable>
          </View>
        )}

        <Text style={styles.sectionLabel}>{t.settings.planSection}</Text>
        <View style={styles.card}>
          <Row label={t.settings.calorieTarget} value={`${plan.calorieTarget} kcal`} />
          <Row label={t.settings.bmr} value={`${plan.bmr} kcal`} />
          <Row label={t.settings.tdee} value={`${plan.tdee} kcal`} />
          <Row label={t.settings.protein} value={`${plan.proteinG}g`} />
          <Row label={t.settings.carbs} value={`${plan.carbsG}g`} />
          <Row label={t.settings.fat} value={`${plan.fatG}g`} />
        </View>

        <Text style={styles.sectionLabel}>{t.settings.profileSection}</Text>
        <View style={styles.card}>
          <View style={styles.weightRow}>
            <Text style={styles.rowLabel}>{t.settings.heightLabel}</Text>
            <TextInput
              style={styles.weightInput}
              value={heightCmInput}
              onChangeText={setHeightCmInput}
              onEndEditing={handleHeightUpdate}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.weightRow}>
            <Text style={styles.rowLabel}>{t.settings.weightLabel}</Text>
            <TextInput
              style={styles.weightInput}
              value={weightKgInput}
              onChangeText={setWeightKgInput}
              onEndEditing={handleWeightUpdate}
              keyboardType="decimal-pad"
            />
          </View>
          <Pressable
            style={({ pressed }) => [styles.tapRow, pressed && styles.pressedDim]}
            onPress={cycleActivity}
          >
            <Text style={styles.rowLabel}>{t.settings.activityLevel}</Text>
            <Text style={styles.rowValueLink}>{ACTIVITY_LABELS[profile.activityLevel]} ›</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.tapRow, pressed && styles.pressedDim]}
            onPress={cycleGoal}
          >
            <Text style={styles.rowLabel}>{t.settings.goal}</Text>
            <Text style={styles.rowValueLink}>{GOAL_LABELS[profile.goal]} ›</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>{t.settings.hydrationSection}</Text>
        <View style={styles.card}>
          <Text style={styles.hint}>{t.settings.hydrationHint}</Text>
          <View style={styles.weightRow}>
            <Text style={styles.rowLabel}>{t.settings.waterTargetLabel}</Text>
            <TextInput
              style={styles.weightInput}
              value={waterTargetInput}
              onChangeText={setWaterTargetInput}
              onEndEditing={handleSaveWaterTarget}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t.settings.languageSection}</Text>
        <View style={styles.card}>
          <Text style={styles.hint}>{t.settings.languageHint}</Text>
          <View style={styles.languageGrid}>
            {LANGUAGES.map((l) => {
              const active = l.code === language;
              return (
                <Pressable
                  key={l.code}
                  style={({ pressed }) => [
                    styles.languageChip,
                    active && styles.languageChipActive,
                    pressed && styles.pressedDim,
                  ]}
                  onPress={() => setLanguage(l.code)}
                >
                  <Text style={[styles.languageChipText, active && styles.languageChipTextActive]}>
                    {l.nativeName}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Text style={styles.sectionLabel}>{t.settings.aiSection}</Text>
        <View style={styles.card}>
          <Text style={styles.hint}>{t.settings.aiHint}</Text>
          <TextInput
            style={styles.keyInput}
            placeholder="sk-ant-..."
            placeholderTextColor={colors.textMuted}
            value={keyInput}
            onChangeText={setKeyInput}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressedDim]}
            onPress={handleSaveKey}
          >
            <Text style={styles.saveButtonText}>{t.settings.saveApiKey}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>{t.settings.recipesSection}</Text>
        <View style={styles.card}>
          <Text style={styles.hint}>{t.settings.recipesHint}</Text>
          <TextInput
            style={styles.keyInput}
            placeholder={t.settings.recipeApiKeyPlaceholder}
            placeholderTextColor={colors.textMuted}
            value={recipeKeyInput}
            onChangeText={setRecipeKeyInput}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressedDim]}
            onPress={handleSaveRecipeKey}
          >
            <Text style={styles.saveButtonText}>{t.settings.saveRecipeApiKey}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>{t.settings.remindersSection}</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.reminderTextWrap}>
              <Text style={styles.rowLabel}>{t.settings.reminderToggleLabel}</Text>
              <Text style={styles.hint}>{t.settings.reminderHint}</Text>
            </View>
            <Switch
              value={reminder.enabled}
              onValueChange={handleToggleReminder}
              disabled={savingReminder}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </View>
          {reminder.enabled && (
            <View style={styles.reminderTimeRow}>
              {REMINDER_TIME_PRESETS.map((time) => {
                const active = time === reminder.time;
                return (
                  <Pressable
                    key={time}
                    style={({ pressed }) => [
                      styles.languageChip,
                      active && styles.languageChipActive,
                      pressed && styles.pressedDim,
                    ]}
                    onPress={() => handleSelectReminderTime(time)}
                    disabled={savingReminder}
                  >
                    <Text style={[styles.languageChipText, active && styles.languageChipTextActive]}>
                      {formatHourMinute(time)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <Text style={styles.sectionLabel}>{t.settings.exportSection}</Text>
        <View style={styles.card}>
          <Text style={styles.hint}>{t.settings.exportHint}</Text>
          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressedDim]}
            onPress={handleExportData}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.saveButtonText}>{t.settings.exportButton}</Text>
            )}
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.dangerButton, pressed && styles.pressedDim]}
          onPress={handleResetData}
        >
          <Text style={styles.dangerButtonText}>{t.settings.resetDataButton}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function formatHourMinute(time: string): string {
  const [hourStr, minuteStr] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minuteStr} ${period}`;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressedDim: { opacity: 0.6 },
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.sm },
  title: { color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: spacing.sm },
  sectionLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  tapRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  weightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  weightInput: {
    color: colors.text,
    fontWeight: '600',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minWidth: 60,
    textAlign: 'right',
  },
  rowLabel: { color: colors.textMuted, fontSize: 14 },
  rowValue: { color: colors.text, fontWeight: '600', fontSize: 14 },
  rowValueLink: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  hint: { color: colors.textMuted, fontSize: 12 },
  keyInput: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  saveButtonText: { color: colors.background, fontWeight: '700' },
  dangerButton: {
    marginTop: spacing.lg,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.danger,
  },
  dangerButtonText: { color: colors.danger, fontWeight: '700' },
  premiumBadge: { color: colors.primaryDark, fontWeight: '700', fontSize: 14 },
  cancelLink: { alignSelf: 'flex-start', paddingTop: spacing.xs },
  cancelLinkText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  languageChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  languageChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryMuted,
  },
  languageChipText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  languageChipTextActive: {
    color: colors.primaryDark,
  },
  reminderTextWrap: {
    flex: 1,
    gap: 2,
    paddingRight: spacing.md,
  },
  reminderTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
