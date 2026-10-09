import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useMemo, useState } from 'react';
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
import { NutrientList } from '../components/NutrientList';
import { useApp } from '../context/AppContext';
import { estimateNutritionFromText } from '../lib/aiFood';
import { track } from '../lib/analytics';
import { addMicros, hasMicros, scaleMicros } from '../lib/nutrients';
import { RootStackParamList } from '../navigation/types';
import { removeFoodEntry, updateFoodEntry } from '../storage/db';
import { colors, radius, spacing } from '../theme';
import { FoodEntry, Micros } from '../types';

type Route = RouteProp<RootStackParamList, 'EditEntry'>;

const PORTIONS = [0.5, 1, 1.5, 2];
const STEP = 0.25;

interface Base {
  foodName: string;
  quantity: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  micros?: Micros;
}

// "1 cup (150g)" -> 150, so the amount can be edited in grams. Only the first
// gram or ml figure counts; foods without one are edited by portion only.
function gramsIn(quantity: string): number | null {
  const m = quantity.match(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i);
  return m ? parseFloat(m[1].replace(',', '.')) : null;
}

function withGrams(quantity: string, grams: number): string {
  return quantity.replace(/(\d+(?:[.,]\d+)?)(\s*)(g|ml)\b/i, (_m, _n, space, unit) => `${grams}${space}${unit}`);
}

function formatFactor(f: number): string {
  return Number.isInteger(f) ? String(f) : f.toFixed(2).replace(/0$/, '');
}

export function EditEntryScreen() {
  const { t, apiKey, isPremium, refreshToday } = useApp();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { entry } = useRoute<Route>().params;

  // The amounts at portion 1x; the portion multiplies everything.
  const [base, setBase] = useState<Base>({
    foodName: entry.foodName,
    quantity: entry.quantity,
    calories: entry.calories,
    proteinG: entry.proteinG,
    carbsG: entry.carbsG,
    fatG: entry.fatG,
    micros: entry.micros,
  });
  const [factor, setFactor] = useState(1);
  const [saving, setSaving] = useState(false);

  const [extraName, setExtraName] = useState('');
  const [extra, setExtra] = useState({ calories: '', proteinG: '', carbsG: '', fatG: '' });
  const [extraMicros, setExtraMicros] = useState<Micros | undefined>();
  const [lookingUp, setLookingUp] = useState(false);

  const baseGrams = gramsIn(base.quantity);
  const scaled = useMemo(
    () => ({
      calories: Math.round(base.calories * factor),
      proteinG: Math.round(base.proteinG * factor),
      carbsG: Math.round(base.carbsG * factor),
      fatG: Math.round(base.fatG * factor),
      micros: scaleMicros(base.micros, factor),
      quantity:
        factor === 1
          ? base.quantity
          : baseGrams
            ? withGrams(base.quantity, Math.round(baseGrams * factor))
            : `${formatFactor(factor)} × ${base.quantity}`,
    }),
    [base, factor, baseGrams]
  );

  // Typing a number sets the 1x amount so the portion buttons still work on it.
  function setNumber(key: 'calories' | 'proteinG' | 'carbsG' | 'fatG', text: string) {
    const v = parseInt(text.replace(/[^0-9]/g, ''), 10) || 0;
    setBase((b) => ({ ...b, [key]: v / factor }));
  }

  function setGrams(text: string) {
    const g = parseFloat(text.replace(',', '.'));
    if (!baseGrams || !Number.isFinite(g) || g <= 0) return;
    setFactor(g / baseGrams);
  }

  async function handleLookUp() {
    if (!apiKey || !extraName.trim()) return;
    setLookingUp(true);
    try {
      const r = await estimateNutritionFromText(apiKey, extraName.trim());
      setExtraName(r.foodName);
      setExtra({
        calories: String(r.calories),
        proteinG: String(r.proteinG),
        carbsG: String(r.carbsG),
        fatG: String(r.fatG),
      });
      setExtraMicros(r.micros);
    } catch (err) {
      Alert.alert(t.logFood.lookUpFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setLookingUp(false);
    }
  }

  // Adding an item fixes the current portion into the meal, then adds the
  // new item's numbers on top, e.g. "Bread" + "butter" -> "Bread + butter".
  function handleAddItem() {
    const name = extraName.trim();
    if (!name) return;
    const n = (s: string) => parseInt(s, 10) || 0;
    setBase({
      foodName: `${base.foodName} + ${name}`,
      quantity: scaled.quantity,
      calories: scaled.calories + n(extra.calories),
      proteinG: scaled.proteinG + n(extra.proteinG),
      carbsG: scaled.carbsG + n(extra.carbsG),
      fatG: scaled.fatG + n(extra.fatG),
      micros: addMicros(scaled.micros, extraMicros),
    });
    setFactor(1);
    setExtraName('');
    setExtra({ calories: '', proteinG: '', carbsG: '', fatG: '' });
    setExtraMicros(undefined);
  }

  async function handleSave() {
    setSaving(true);
    const updated: FoodEntry = {
      ...entry,
      foodName: base.foodName.trim() || entry.foodName,
      quantity: scaled.quantity,
      calories: scaled.calories,
      proteinG: scaled.proteinG,
      carbsG: scaled.carbsG,
      fatG: scaled.fatG,
      micros: scaled.micros,
    };
    await updateFoodEntry(updated);
    await refreshToday();
    track('food_edited');
    setSaving(false);
    navigation.goBack();
  }

  function handleDelete() {
    Alert.alert(t.editEntry.deleteConfirm, '', [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: t.editEntry.delete,
        style: 'destructive',
        onPress: async () => {
          await removeFoodEntry(entry.date, entry.id);
          await refreshToday();
          navigation.goBack();
        },
      },
    ]);
  }

  const macroFields: { key: 'calories' | 'proteinG' | 'carbsG' | 'fatG'; label: string }[] = [
    { key: 'calories', label: 'kcal' },
    { key: 'proteinG', label: t.onboarding.protein },
    { key: 'carbsG', label: t.onboarding.carbs },
    { key: 'fatG', label: t.onboarding.fat },
  ];

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t.editEntry.name}</Text>
        <TextInput
          style={styles.input}
          value={base.foodName}
          onChangeText={(v) => setBase((b) => ({ ...b, foodName: v }))}
          maxLength={80}
        />

        <Text style={styles.label}>{t.editEntry.portion}</Text>
        <View style={styles.card}>
          <View style={styles.portionRow}>
            <Pressable
              style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
              onPress={() => setFactor((f) => Math.max(STEP, f - STEP))}
              accessibilityLabel="−"
            >
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <View style={styles.portionCenter}>
              <Text style={styles.factorText}>{formatFactor(factor)}×</Text>
              <Text style={styles.quantityText} numberOfLines={1}>
                {scaled.quantity}
              </Text>
            </View>
            <Pressable
              style={({ pressed }) => [styles.stepButton, pressed && styles.pressed]}
              onPress={() => setFactor((f) => Math.min(10, f + STEP))}
              accessibilityLabel="+"
            >
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
          <View style={styles.chipRow}>
            {PORTIONS.map((p) => {
              const active = Math.abs(p - factor) < 0.001;
              return (
                <Pressable
                  key={p}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setFactor(p)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{formatFactor(p)}×</Text>
                </Pressable>
              );
            })}
          </View>
          {baseGrams !== null && (
            <View style={styles.gramsRow}>
              <Text style={styles.gramsLabel}>{t.editEntry.grams}</Text>
              <TextInput
                key={factor}
                style={styles.gramsInput}
                defaultValue={String(Math.round(baseGrams * factor))}
                onEndEditing={(e) => setGrams(e.nativeEvent.text)}
                keyboardType="decimal-pad"
                returnKeyType="done"
                maxLength={6}
              />
            </View>
          )}
        </View>

        <Text style={styles.label}>{t.editEntry.nutrition}</Text>
        <View style={styles.numbersRow}>
          {macroFields.map(({ key, label }) => (
            <View key={key} style={styles.numberField}>
              <Text style={styles.numberLabel}>{label}</Text>
              <TextInput
                key={`${key}-${factor}-${base[key]}`}
                style={styles.numberInput}
                defaultValue={String(scaled[key])}
                onEndEditing={(e) => setNumber(key, e.nativeEvent.text)}
                keyboardType="number-pad"
                returnKeyType="done"
                maxLength={5}
              />
            </View>
          ))}
        </View>

        {hasMicros(scaled.micros) && (
          <>
            <Text style={styles.label}>{t.nutrients.title}</Text>
            <View style={styles.card}>
              {isPremium ? (
                <NutrientList micros={scaled.micros} />
              ) : (
                <Pressable onPress={() => navigation.navigate('Paywall')}>
                  <Text style={styles.lockedText}>{t.nutrients.premiumLocked}</Text>
                  <Text style={styles.unlockText}>{t.nutrients.unlock} →</Text>
                </Pressable>
              )}
              {isPremium && <Text style={styles.approx}>{t.nutrients.approx}</Text>}
            </View>
          </>
        )}

        <Text style={styles.label}>{t.editEntry.addItem}</Text>
        <View style={styles.card}>
          <View style={styles.addRow}>
            <TextInput
              style={[styles.input, styles.addInput]}
              placeholder={t.editEntry.addItemPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={extraName}
              onChangeText={setExtraName}
              maxLength={80}
            />
            {apiKey && isPremium && (
              <Pressable
                style={({ pressed }) => [styles.lookUpButton, pressed && styles.pressed]}
                onPress={handleLookUp}
                disabled={lookingUp || !extraName.trim()}
              >
                {lookingUp ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.lookUpText}>{t.editEntry.lookUp}</Text>
                )}
              </Pressable>
            )}
          </View>
          <View style={styles.numbersRow}>
            {macroFields.map(({ key, label }) => (
              <View key={key} style={styles.numberField}>
                <Text style={styles.numberLabel}>{label}</Text>
                <TextInput
                  style={styles.numberInput}
                  value={extra[key]}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  onChangeText={(v) => setExtra((x) => ({ ...x, [key]: v.replace(/[^0-9]/g, '') }))}
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [styles.addButton, !extraName.trim() && styles.disabled, pressed && styles.pressed]}
            onPress={handleAddItem}
            disabled={!extraName.trim()}
          >
            <Text style={styles.addButtonText}>+ {t.editEntry.addButton}</Text>
          </Pressable>
        </View>

        <Pressable
          style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color={colors.background} />
          ) : (
            <Text style={styles.saveText}>{t.editEntry.save}</Text>
          )}
        </Pressable>
        <Pressable onPress={handleDelete} style={styles.deleteButton} hitSlop={8}>
          <Text style={styles.deleteText}>{t.editEntry.delete}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: spacing.xl * 2, gap: spacing.sm },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  portionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { color: colors.white, fontSize: 24, fontWeight: '700', marginTop: -2 },
  portionCenter: { flex: 1, alignItems: 'center' },
  factorText: { color: colors.text, fontSize: 26, fontWeight: '800' },
  quantityText: { color: colors.textMuted, fontSize: 13 },
  chipRow: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.text, fontWeight: '700' },
  chipTextActive: { color: colors.white },
  gramsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gramsLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  gramsInput: {
    minWidth: 90,
    textAlign: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  numbersRow: { flexDirection: 'row', gap: spacing.sm },
  numberField: { flex: 1, alignItems: 'center', gap: 4 },
  numberLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  numberInput: {
    alignSelf: 'stretch',
    textAlign: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 17,
    fontWeight: '700',
  },
  lockedText: { color: colors.text, fontSize: 14, fontWeight: '600' },
  unlockText: { color: colors.accent, fontSize: 14, fontWeight: '700', marginTop: 4 },
  approx: { color: colors.textMuted, fontSize: 11 },
  addRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  addInput: { flex: 1, backgroundColor: colors.background },
  lookUpButton: {
    backgroundColor: colors.ink,
    borderRadius: radius.full,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  lookUpText: { color: colors.white, fontWeight: '700' },
  addButton: {
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.accent,
    paddingVertical: 11,
    alignItems: 'center',
  },
  addButtonText: { color: colors.accent, fontWeight: '800', fontSize: 15 },
  saveButton: {
    marginTop: spacing.md,
    backgroundColor: colors.ink,
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveText: { color: colors.white, fontSize: 16, fontWeight: '800' },
  deleteButton: { alignItems: 'center', paddingVertical: spacing.sm },
  deleteText: { color: colors.danger, fontWeight: '700' },
});
