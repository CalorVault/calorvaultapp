import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { mealImage } from '../lib/mealPhotos';
import { FoodEntry } from '../types';
import { LogoScanFrame } from './FlameLogo';
import { IconBadge } from './IconBadge';
import { MealIcon, MicIcon, PlanDayIcon, SearchIcon } from './NavIcons';
import { CarbsIcon, FatIcon, ProteinIcon } from './NutritionIcons';
import { colors, radius, spacing } from '../theme';

const THUMB_SIZE = 56;

// Entries without a photo get the same black-and-orange badge as the way
// they were logged in the + menu, instead of an emoji.
function MethodBadge({ method }: { method: FoodEntry['method'] }) {
  if (method === 'camera' || method === 'barcode') {
    return <LogoScanFrame size={THUMB_SIZE} glyphScale={0.38} />;
  }
  if (method === 'voice') return <IconBadge Icon={MicIcon} size={THUMB_SIZE} />;
  if (method === 'manual') return <IconBadge Icon={SearchIcon} size={THUMB_SIZE} />;
  return <IconBadge Icon={PlanDayIcon} size={THUMB_SIZE} />;
}

interface Props {
  entry: FoodEntry;
  onDelete?: (id: string) => void;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const period = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  return `${hours}:${minutes}${period}`;
}

export function FoodEntryRow({ entry, onDelete }: Props) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const image = photoFailed ? null : mealImage(entry);
  return (
    <View style={styles.row}>
      {image ? (
        <Image source={image} style={styles.thumb} onError={() => setPhotoFailed(true)} />
      ) : (
        <View style={styles.thumbFallback}>
          <MethodBadge method={entry.method} />
        </View>
      )}
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>
          {entry.foodName}
        </Text>
        <Text style={styles.time}>{formatTime(entry.loggedAt)}</Text>
        <View style={styles.macroRow}>
          <View style={styles.macroItem}>
            <ProteinIcon size={11} color={colors.protein} />
            <Text style={[styles.macroText, { color: colors.protein }]}>{entry.proteinG}</Text>
          </View>
          <View style={styles.macroItem}>
            <CarbsIcon size={11} color={colors.carbs} />
            <Text style={[styles.macroText, { color: colors.carbs }]}>{entry.carbsG}</Text>
          </View>
          <View style={styles.macroItem}>
            <FatIcon size={11} color={colors.fat} />
            <Text style={[styles.macroText, { color: colors.fat }]}>{entry.fatG}</Text>
          </View>
        </View>
      </View>
      <View style={styles.right}>
        <View style={styles.caloriePill}>
          <MealIcon size={12} color={colors.text} />
          <Text style={styles.calorieText}>{entry.calories}</Text>
        </View>
        {onDelete && (
          <Pressable
            onPress={() => onDelete(entry.id)}
            hitSlop={10}
            style={styles.deleteButton}
            accessibilityLabel={`Delete ${entry.foodName}`}
            accessibilityRole="button"
          >
            <Text style={styles.deleteText}>✕</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    marginRight: spacing.md,
  },
  thumbFallback: {
    marginRight: spacing.md,
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  time: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 1,
  },
  macroRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: 4,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  macroText: {
    fontSize: 11,
    fontWeight: '600',
  },
  right: {
    alignItems: 'flex-end',
    gap: 6,
  },
  caloriePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  calorieText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  deleteButton: {
    padding: 2,
  },
  deleteText: {
    color: colors.textMuted,
    fontSize: 13,
  },
});
