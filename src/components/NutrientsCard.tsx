import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { countWithMicros, MicroKey, sumMicros } from '../lib/nutrients';
import { colors, radius, spacing } from '../theme';
import { FoodEntry } from '../types';
import { ChevronIcon } from './CommunityIcons';
import { NutrientList } from './NutrientList';

// The ones most people check first; the rest show when the card is opened.
const SUMMARY: MicroKey[] = ['fiberG', 'saltG', 'ironMg', 'vitaminCMg'];

export function NutrientsCard({ entries, onUnlock }: { entries: FoodEntry[]; onUnlock: () => void }) {
  const { t, isPremium } = useApp();
  const [open, setOpen] = useState(false);
  const counted = countWithMicros(entries);

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setOpen((o) => !o)} disabled={!isPremium || counted === 0}>
        <Text style={styles.title}>{t.nutrients.title}</Text>
        {isPremium && counted > 0 && (
          <View style={[styles.chevron, open && styles.chevronOpen]}>
            <ChevronIcon size={14} color={colors.textMuted} />
          </View>
        )}
      </Pressable>
      {!isPremium ? (
        <Pressable onPress={onUnlock}>
          <Text style={styles.text}>{t.nutrients.premiumLocked}</Text>
          <Text style={styles.unlock}>{t.nutrients.unlock} →</Text>
        </Pressable>
      ) : counted === 0 ? (
        <Text style={styles.text}>{t.nutrients.none}</Text>
      ) : (
        <>
          <NutrientList micros={sumMicros(entries)} only={open ? undefined : SUMMARY} />
          <Text style={styles.note}>
            {counted < entries.length ? `${t.nutrients.basedOn} (${counted}/${entries.length}) · ` : ''}
            {t.nutrients.approx}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: colors.text, fontSize: 17, fontWeight: '800' },
  chevron: { transform: [{ rotate: '90deg' }] },
  chevronOpen: { transform: [{ rotate: '-90deg' }] },
  text: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
  unlock: { color: colors.accent, fontSize: 14, fontWeight: '700', marginTop: 4 },
  note: { color: colors.textMuted, fontSize: 11 },
});
