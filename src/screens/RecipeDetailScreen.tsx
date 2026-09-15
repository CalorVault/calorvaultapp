import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CarbsIcon, FatIcon, ProteinIcon } from '../components/NutritionIcons';
import { MealIcon } from '../components/NavIcons';
import { useApp } from '../context/AppContext';
import { RootStackParamList } from '../navigation/types';
import { todayIso } from '../storage/db';
import { colors, radius, spacing } from '../theme';

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function RecipeDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'RecipeDetail'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { logFood, t } = useApp();
  const [saving, setSaving] = useState(false);
  const { recipe } = route.params;

  async function handleLog() {
    setSaving(true);
    await logFood({
      id: makeId(),
      foodName: recipe.name,
      quantity: '1 serving',
      calories: recipe.calories,
      proteinG: recipe.proteinG,
      carbsG: recipe.carbsG,
      fatG: recipe.fatG,
      date: todayIso(),
      loggedAt: new Date().toISOString(),
      method: 'recipe',
    });
    setSaving(false);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.flex} edges={['bottom']}>
      <View style={[styles.hero, recipe.imageUrl ? null : { backgroundColor: recipe.tint ?? colors.surfaceAlt }]}>
        {recipe.imageUrl ? (
          <Image source={{ uri: recipe.imageUrl }} style={styles.heroImage} />
        ) : (
          <Text style={styles.heroEmoji}>{recipe.emoji}</Text>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name}>{recipe.name}</Text>
        <Text style={styles.time}>{recipe.timeMinutes} {t.recipes.minutes}</Text>

        <View style={styles.caloriesRow}>
          <MealIcon size={22} color={colors.ink} />
          <Text style={styles.caloriesText}>{recipe.calories} kcal</Text>
        </View>

        <View style={styles.macroRow}>
          <MacroStat Icon={CarbsIcon} color={colors.carbs} label={t.onboarding.carbs} grams={recipe.carbsG} />
          <MacroStat Icon={FatIcon} color={colors.fat} label={t.onboarding.fat} grams={recipe.fatG} />
          <MacroStat Icon={ProteinIcon} color={colors.protein} label={t.onboarding.protein} grams={recipe.proteinG} />
        </View>

        <Pressable style={styles.logButton} onPress={handleLog} disabled={saving}>
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.logButtonText}>{t.recipes.logThisMeal}</Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function MacroStat({
  Icon,
  color,
  label,
  grams,
}: {
  Icon: React.ComponentType<{ size?: number; color: string }>;
  color: string;
  label: string;
  grams: number;
}) {
  return (
    <View style={styles.macroStat}>
      <View style={[styles.macroRing, { borderColor: color }]}>
        <Icon size={20} color={color} />
      </View>
      <Text style={styles.macroGrams}>{grams}g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  hero: {
    height: 200,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroEmoji: { fontSize: 72 },
  heroImage: { width: '100%', height: '100%' },
  body: { padding: spacing.lg },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  time: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  caloriesText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  macroStat: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  macroRing: {
    width: 52,
    height: 52,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroGrams: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  macroLabel: {
    color: colors.textMuted,
    fontSize: 12,
  },
  logButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  logButtonText: {
    color: colors.background,
    fontWeight: '700',
    fontSize: 16,
  },
});
