import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { estimateNutritionFromText } from '../lib/aiFood';
import {
  FoodItem,
  FoodUnit,
  matchesRecent,
  nutritionFor,
  quantityLabel,
  recentItem,
  searchFoods,
  searchProducts,
} from '../lib/foodSearch';
import { hasMicros } from '../lib/nutrients';
import { getRecentUniqueFoodEntries } from '../storage/db';
import { colors, radius, spacing } from '../theme';
import { FoodEntry, NutrientEstimate } from '../types';
import { NutrientList } from './NutrientList';

interface Props {
  onSave: (estimate: NutrientEstimate, source?: { recipeId?: string; imageUrl?: string }) => Promise<void>;
  onManual: () => void;
  onUpgrade: () => void;
}

type Row =
  | { kind: 'header'; key: string; title: string; busy?: boolean }
  | { kind: 'item'; key: string; item: FoodItem };

const PRODUCT_DELAY_MS = 450;

// Type any food and pick it: foods you've had before, everyday foods (built in,
// works offline) and supermarket products (online). Then choose how much.
export function FoodSearch({ onSave, onManual, onUpgrade }: Props) {
  const { t, apiKey, isPremium } = useApp();
  const [query, setQuery] = useState('');
  const [recents, setRecents] = useState<FoodEntry[]>([]);
  const [products, setProducts] = useState<FoodItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [selected, setSelected] = useState<FoodItem | null>(null);
  const [askingAi, setAskingAi] = useState(false);

  useEffect(() => {
    getRecentUniqueFoodEntries(30, 60).then(setRecents).catch(() => {});
  }, []);

  const trimmed = query.trim();
  const foods = useMemo(() => (trimmed.length >= 2 ? searchFoods(trimmed) : []), [trimmed]);
  const recentMatches = useMemo(
    () => (trimmed ? recents.filter((e) => matchesRecent(e, trimmed)) : recents).slice(0, trimmed ? 5 : 15),
    [recents, trimmed]
  );

  // Products are looked up online a moment after typing stops.
  const requestRef = useRef<AbortController | null>(null);
  useEffect(() => {
    requestRef.current?.abort();
    setProducts([]);
    if (trimmed.length < 3) {
      setLoadingProducts(false);
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setLoadingProducts(true);
    const timer = setTimeout(() => {
      searchProducts(trimmed, controller.signal)
        .then((items) => {
          if (!controller.signal.aborted) setProducts(items);
        })
        .catch(() => {})
        .finally(() => {
          if (!controller.signal.aborted) setLoadingProducts(false);
        });
    }, PRODUCT_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const rows: Row[] = [];
  if (recentMatches.length) {
    rows.push({ kind: 'header', key: 'h-recent', title: t.foodSearch.recent });
    recentMatches.forEach((e) => rows.push({ kind: 'item', key: `r-${e.id}`, item: recentItem(e) }));
  }
  if (foods.length) {
    rows.push({ kind: 'header', key: 'h-foods', title: t.foodSearch.foods });
    foods.forEach((item) => rows.push({ kind: 'item', key: item.key, item }));
  }
  if (trimmed.length >= 3 && (products.length || loadingProducts)) {
    rows.push({ kind: 'header', key: 'h-products', title: t.foodSearch.products, busy: loadingProducts });
    products.forEach((item) => rows.push({ kind: 'item', key: item.key, item }));
  }

  async function askAi() {
    if (!apiKey || !isPremium) {
      onUpgrade();
      return;
    }
    setAskingAi(true);
    try {
      const r = await estimateNutritionFromText(apiKey, trimmed);
      setSelected({
        key: 'ai',
        name: r.foodName,
        source: 'recent',
        units: [{ label: r.quantity, nutrition: r }],
      });
    } catch (err) {
      Alert.alert(t.logFood.lookUpFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setAskingAi(false);
    }
  }

  if (selected) {
    return <AmountPicker item={selected} onBack={() => setSelected(null)} onSave={onSave} />;
  }

  return (
    <View style={styles.flex}>
      <View style={styles.searchBox}>
        <TextInput
          style={styles.searchInput}
          placeholder={t.foodSearch.placeholder}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          maxLength={60}
        />
      </View>
      <FlatList
        data={rows}
        keyExtractor={(r) => r.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        renderItem={({ item: row }) =>
          row.kind === 'header' ? (
            <View style={styles.header}>
              <Text style={styles.headerText}>{row.title}</Text>
              {row.busy && <ActivityIndicator size="small" color={colors.textMuted} />}
            </View>
          ) : (
            <ResultRow item={row.item} onPress={() => setSelected(row.item)} />
          )
        }
        ListEmptyComponent={
          trimmed.length >= 2 && !loadingProducts ? (
            <Text style={styles.empty}>{t.foodSearch.noResults}</Text>
          ) : null
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {trimmed.length >= 2 && (
              <Pressable
                style={({ pressed }) => [styles.footerButton, pressed && styles.pressed]}
                onPress={askAi}
                disabled={askingAi}
              >
                {askingAi ? (
                  <ActivityIndicator color={colors.accent} size="small" />
                ) : (
                  <Text style={styles.footerButtonText}>
                    ✨ {t.foodSearch.askAi} “{trimmed}”{!isPremium ? ' · Premium' : ''}
                  </Text>
                )}
              </Pressable>
            )}
            <Pressable onPress={onManual} hitSlop={8}>
              <Text style={styles.manualText}>{t.foodSearch.enterManually}</Text>
            </Pressable>
          </View>
        }
      />
    </View>
  );
}

function ResultRow({ item, onPress }: { item: FoodItem; onPress: () => void }) {
  const { t } = useApp();
  const first = item.units[0];
  const n = item.per100 && first.label === 'g' ? nutritionFor(item, first, 100) : nutritionFor(item, first, 1);
  const unitLabel = first.label === 'g' ? '100 g' : quantityLabel(first, 1);
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={2}>
          {item.source === 'recent' && <Text style={styles.star}>★ </Text>}
          {item.name}
        </Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {item.brand ? `${item.brand} · ` : ''}
          {unitLabel}
        </Text>
      </View>
      <View style={styles.kcalPill}>
        <Text style={styles.kcalText}>{n.calories}</Text>
        <Text style={styles.kcalUnit}>{t.foodSearch.kcal}</Text>
      </View>
    </Pressable>
  );
}

const COUNT_STEPS = [0.5, 1, 1.5, 2];

function AmountPicker({
  item,
  onBack,
  onSave,
}: {
  item: FoodItem;
  onBack: () => void;
  onSave: Props['onSave'];
}) {
  const { t, isPremium } = useApp();
  const [unit, setUnit] = useState<FoodUnit>(item.units[0]);
  const [countText, setCountText] = useState(item.units[0].label === 'g' ? '100' : '1');
  const [saving, setSaving] = useState(false);

  const count = Math.max(0, parseFloat(countText.replace(',', '.')) || 0);
  const n = nutritionFor(item, unit, count);
  const isGrams = unit.label === 'g';

  // Switching to grams keeps the same amount, e.g. 2 slices (56 g) -> 56 g.
  function chooseUnit(u: FoodUnit) {
    const currentGrams = unit.grams !== undefined ? unit.grams * count : undefined;
    setUnit(u);
    setCountText(u.label === 'g' ? String(Math.round(currentGrams || 100)) : '1');
  }

  async function handleAdd() {
    if (count <= 0) return;
    setSaving(true);
    try {
      await onSave(
        {
          foodName: item.brand ? `${item.name} (${item.brand})` : item.name,
          quantity: quantityLabel(unit, count),
          calories: n.calories,
          proteinG: n.proteinG,
          carbsG: n.carbsG,
          fatG: n.fatG,
          micros: n.micros,
          confidence: 'high',
        },
        { recipeId: item.recipeId, imageUrl: item.imageUrl }
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.picker} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} hitSlop={8}>
        <Text style={styles.backText}>‹ {t.foodSearch.back}</Text>
      </Pressable>
      <Text style={styles.pickerName}>{item.name}</Text>
      {item.brand && <Text style={styles.pickerBrand}>{item.brand}</Text>}

      <Text style={styles.label}>{t.foodSearch.amount}</Text>
      <View style={styles.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.unitRow}>
          {item.units.map((u) => {
            const active = u === unit;
            return (
              <Pressable key={u.label} style={[styles.unitChip, active && styles.unitChipActive]} onPress={() => chooseUnit(u)}>
                <Text style={[styles.unitText, active && styles.unitTextActive]}>
                  {u.label === 'g' ? t.foodSearch.grams : u.label}
                  {u.grams !== undefined && u.label !== 'g' ? ` · ${Math.round(u.grams)} g` : ''}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={styles.countRow}>
          <TextInput
            style={styles.countInput}
            value={countText}
            onChangeText={(v) => setCountText(v.replace(/[^0-9.,]/g, ''))}
            keyboardType="decimal-pad"
            selectTextOnFocus
            maxLength={6}
          />
          <Text style={styles.countUnit}>{isGrams ? 'g' : '×'}</Text>
        </View>
        {!isGrams && (
          <View style={styles.stepRow}>
            {COUNT_STEPS.map((c) => (
              <Pressable
                key={c}
                style={[styles.stepChip, count === c && styles.unitChipActive]}
                onPress={() => setCountText(String(c))}
              >
                <Text style={[styles.unitText, count === c && styles.unitTextActive]}>{c}×</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.totals}>
        <Total label={t.foodSearch.kcal} value={n.calories} strong />
        <Total label={t.onboarding.protein} value={n.proteinG} unit="g" />
        <Total label={t.onboarding.carbs} value={n.carbsG} unit="g" />
        <Total label={t.onboarding.fat} value={n.fatG} unit="g" />
      </View>

      {isPremium && hasMicros(n.micros) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t.nutrients.title}</Text>
          <NutrientList micros={n.micros} />
          <Text style={styles.approx}>{t.nutrients.approx}</Text>
        </View>
      )}

      <Pressable
        style={({ pressed }) => [styles.addButton, count <= 0 && styles.disabled, pressed && styles.pressed]}
        onPress={handleAdd}
        disabled={saving || count <= 0}
      >
        {saving ? <ActivityIndicator color={colors.white} /> : <Text style={styles.addText}>{t.logFood.addToLog}</Text>}
      </Pressable>
    </ScrollView>
  );
}

function Total({ label, value, unit, strong }: { label: string; value: number; unit?: string; strong?: boolean }) {
  return (
    <View style={styles.total}>
      <Text style={[styles.totalValue, strong && styles.totalStrong]}>
        {value}
        {unit ? <Text style={styles.totalUnit}>{unit}</Text> : null}
      </Text>
      <Text style={styles.totalLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pressed: { opacity: 0.6 },
  disabled: { opacity: 0.4 },
  searchBox: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  searchInput: {
    backgroundColor: colors.surface,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    fontSize: 17,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl * 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md, marginBottom: 6 },
  headerText: { color: colors.textMuted, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginBottom: 6,
    gap: spacing.sm,
  },
  rowText: { flex: 1 },
  rowName: { color: colors.text, fontSize: 15, fontWeight: '700' },
  star: { color: colors.accent },
  rowMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  kcalPill: { alignItems: 'flex-end' },
  kcalText: { color: colors.text, fontSize: 16, fontWeight: '800' },
  kcalUnit: { color: colors.textMuted, fontSize: 11 },
  empty: { color: colors.textMuted, textAlign: 'center', marginTop: spacing.lg },
  footer: { alignItems: 'center', gap: spacing.md, marginTop: spacing.lg },
  footerButton: {
    alignSelf: 'stretch',
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.accent,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
  },
  footerButtonText: { color: colors.accent, fontWeight: '700', fontSize: 14 },
  manualText: { color: colors.textMuted, fontWeight: '600', textDecorationLine: 'underline' },
  picker: { padding: spacing.lg, gap: spacing.sm, paddingBottom: spacing.xl * 2 },
  backText: { color: colors.accent, fontWeight: '700', fontSize: 15 },
  pickerName: { color: colors.text, fontSize: 22, fontWeight: '800', marginTop: spacing.sm },
  pickerBrand: { color: colors.textMuted, fontSize: 14 },
  label: { color: colors.textMuted, fontSize: 13, fontWeight: '700', marginTop: spacing.md },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.md },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '800' },
  unitRow: { gap: spacing.sm },
  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  unitChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  unitText: { color: colors.text, fontWeight: '700', fontSize: 13 },
  unitTextActive: { color: colors.white },
  countRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  countInput: {
    minWidth: 110,
    textAlign: 'center',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    paddingVertical: 12,
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
  },
  countUnit: { color: colors.textMuted, fontSize: 20, fontWeight: '700' },
  stepRow: { flexDirection: 'row', gap: spacing.sm },
  stepChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
  },
  totals: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  total: { flex: 1, alignItems: 'center' },
  totalValue: { color: colors.text, fontSize: 18, fontWeight: '800' },
  totalStrong: { color: colors.accent, fontSize: 22 },
  totalUnit: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  totalLabel: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  approx: { color: colors.textMuted, fontSize: 11 },
  addButton: {
    marginTop: spacing.md,
    backgroundColor: colors.ink,
    borderRadius: radius.full,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addText: { color: colors.white, fontSize: 16, fontWeight: '800' },
});
