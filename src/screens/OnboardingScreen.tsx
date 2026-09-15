import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { Translations } from '../i18n';
import { calculateDailyPlan } from '../lib/calorieCalc';
import { colors, radius, spacing } from '../theme';
import { ActivityLevel, Goal, Sex, UserProfile } from '../types';

function activityOptions(t: Translations): { value: ActivityLevel; label: string; hint: string }[] {
  const o = t.onboarding.activityOptions;
  return [
    { value: 'sedentary', ...o.sedentary },
    { value: 'light', ...o.light },
    { value: 'moderate', ...o.moderate },
    { value: 'active', ...o.active },
    { value: 'very_active', ...o.veryActive },
  ];
}

function goalOptions(t: Translations): { value: Goal; label: string; hint: string }[] {
  const o = t.onboarding.goalOptions;
  return [
    { value: 'lose', ...o.lose },
    { value: 'maintain', ...o.maintain },
    { value: 'gain', ...o.gain },
    { value: 'build_muscle', ...o.buildMuscle },
  ];
}

const STEPS = ['name', 'sex', 'height', 'weight', 'activity', 'goal', 'review'] as const;

// Onboarding stays quick by skipping the age question -- most adult calorie
// needs land close together, so a fixed typical-adult age keeps the BMR
// estimate reasonable without adding a step.
const DEFAULT_AGE = 30;

export function OnboardingScreen() {
  const { completeOnboarding, t } = useApp();
  const ACTIVITY_OPTIONS = useMemo(() => activityOptions(t), [t]);
  const GOAL_OPTIONS = useMemo(() => goalOptions(t), [t]);
  const [stepIndex, setStepIndex] = useState(0);

  const [name, setName] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [heightCmInput, setHeightCmInput] = useState('');
  const [weightKgInput, setWeightKgInput] = useState('');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const step = STEPS[stepIndex];

  const heightCm = useMemo(() => {
    const cm = parseFloat(heightCmInput);
    return Number.isNaN(cm) ? 0 : cm;
  }, [heightCmInput]);

  const weightKg = useMemo(() => {
    const kg = parseFloat(weightKgInput);
    return Number.isNaN(kg) ? 0 : kg;
  }, [weightKgInput]);

  const previewPlan = useMemo(() => {
    if (!sex || !activityLevel || !goal || !heightCm || !weightKg) return null;
    return calculateDailyPlan(sex, weightKg, heightCm, DEFAULT_AGE, activityLevel, goal);
  }, [sex, activityLevel, goal, heightCm, weightKg]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 'name':
        return name.trim().length > 0;
      case 'sex':
        return sex !== null;
      case 'height':
        return heightCm > 0;
      case 'weight':
        return weightKg > 0;
      case 'activity':
        return activityLevel !== null;
      case 'goal':
        return goal !== null;
      case 'review':
        return true;
      default:
        return false;
    }
  }, [step, name, sex, heightCm, weightKg, activityLevel, goal]);

  async function handleNext() {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
      return;
    }
    if (!sex || !activityLevel || !goal) return;
    setSubmitting(true);
    const profile: UserProfile = {
      name: name.trim(),
      sex,
      age: DEFAULT_AGE,
      heightCm: Math.round(heightCm),
      weightKg: Math.round(weightKg * 10) / 10,
      activityLevel,
      goal,
      createdAt: new Date().toISOString(),
    };
    await completeOnboarding(profile);
    setSubmitting(false);
  }

  function handleBack() {
    if (stepIndex > 0) setStepIndex(stepIndex - 1);
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.progressRow}>
          {STEPS.map((s, i) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                i <= stepIndex && styles.progressDotActive,
              ]}
            />
          ))}
        </View>

        {step === 'name' && (
          <View style={styles.stepBlock}>
            <Text style={styles.title}>{t.onboarding.welcomeTitle}</Text>
            <Text style={styles.subtitle}>{t.onboarding.welcomeSubtitle}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.onboarding.namePlaceholder}
              placeholderTextColor={colors.textMuted}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>
        )}

        {step === 'sex' && (
          <View style={styles.stepBlock}>
            <Text style={styles.title}>{t.onboarding.sexTitle}</Text>
            <Text style={styles.subtitle}>{t.onboarding.sexSubtitle}</Text>
            <View style={styles.optionRow}>
              {(['male', 'female'] as Sex[]).map((option) => (
                <Pressable
                  key={option}
                  style={[styles.choice, sex === option && styles.choiceSelected]}
                  onPress={() => setSex(option)}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      sex === option && styles.choiceTextSelected,
                    ]}
                  >
                    {option === 'male' ? t.onboarding.male : t.onboarding.female}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === 'height' && (
          <View style={styles.stepBlock}>
            <Text style={styles.title}>{t.onboarding.heightTitle}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.onboarding.heightPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={heightCmInput}
              onChangeText={setHeightCmInput}
              keyboardType="number-pad"
              autoFocus
            />
          </View>
        )}

        {step === 'weight' && (
          <View style={styles.stepBlock}>
            <Text style={styles.title}>{t.onboarding.weightTitle}</Text>
            <TextInput
              style={styles.input}
              placeholder={t.onboarding.weightPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={weightKgInput}
              onChangeText={setWeightKgInput}
              keyboardType="decimal-pad"
              autoFocus
            />
          </View>
        )}

        {step === 'activity' && (
          <View style={styles.stepBlock}>
            <Text style={styles.title}>{t.onboarding.activityTitle}</Text>
            <View style={styles.optionList}>
              {ACTIVITY_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.listChoice,
                    activityLevel === option.value && styles.choiceSelected,
                  ]}
                  onPress={() => setActivityLevel(option.value)}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      activityLevel === option.value && styles.choiceTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.choiceHint}>{option.hint}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === 'goal' && (
          <View style={styles.stepBlock}>
            <Text style={styles.title}>{t.onboarding.goalTitle}</Text>
            <View style={styles.optionList}>
              {GOAL_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[
                    styles.listChoice,
                    goal === option.value && styles.choiceSelected,
                  ]}
                  onPress={() => setGoal(option.value)}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      goal === option.value && styles.choiceTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  <Text style={styles.choiceHint}>{option.hint}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {step === 'review' && previewPlan && (
          <View style={styles.stepBlock}>
            <Text style={styles.title}>{t.onboarding.reviewTitle}</Text>
            <Text style={styles.subtitle}>{t.onboarding.reviewSubtitle}</Text>
            <View style={styles.planCard}>
              <Text style={styles.planCalories}>
                {previewPlan.calorieTarget} {t.onboarding.kcalPerDay}
              </Text>
              <View style={styles.planMacroRow}>
                <Text style={styles.planMacro}>{t.onboarding.protein} {previewPlan.proteinG}g</Text>
                <Text style={styles.planMacro}>{t.onboarding.carbs} {previewPlan.carbsG}g</Text>
                <Text style={styles.planMacro}>{t.onboarding.fat} {previewPlan.fatG}g</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.navRow}>
          {stepIndex > 0 && (
            <Pressable style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backButtonText}>{t.common.back}</Text>
            </Pressable>
          )}
          <Pressable
            style={[styles.nextButton, !canProceed && styles.nextButtonDisabled]}
            onPress={handleNext}
            disabled={!canProceed || submitting}
          >
            <Text style={styles.nextButtonText}>
              {step === 'review' ? t.onboarding.letsGo : t.common.continue}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
    marginBottom: spacing.xl,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  stepBlock: {
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 18,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  optionList: {
    gap: spacing.sm,
  },
  choice: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  listChoice: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  choiceSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
  },
  choiceText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 15,
  },
  choiceTextSelected: {
    color: colors.primary,
  },
  choiceHint: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.md,
  },
  planCalories: {
    color: colors.primary,
    fontSize: 32,
    fontWeight: '700',
  },
  planMacroRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  planMacro: {
    color: colors.textMuted,
    fontSize: 14,
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  backButton: {
    padding: spacing.md,
    justifyContent: 'center',
  },
  backButtonText: {
    color: colors.textMuted,
    fontWeight: '600',
  },
  nextButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  nextButtonDisabled: {
    opacity: 0.4,
  },
  nextButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
});
