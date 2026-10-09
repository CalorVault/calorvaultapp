import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { formatMicro, MicroKey, microTargets, MICROS } from '../lib/nutrients';
import { colors, radius } from '../theme';
import { Micros } from '../types';

// Rows of nutrients with a bar against the daily target. Bars for things to
// keep under (sugar, saturated fat, salt) turn red once over the maximum;
// the rest fill green as you get closer to the target.
export function NutrientList({ micros, only }: { micros: Micros; only?: MicroKey[] }) {
  const { profile, t } = useApp();
  const targets = microTargets(profile?.sex);
  return (
    <View style={styles.list}>
      {MICROS.filter(({ key }) => !only || only.includes(key)).map(({ key, unit, limit }) => {
        const value = micros[key];
        const target = targets[key];
        const share = typeof value === 'number' ? Math.min(1, value / target) : 0;
        const over = limit && typeof value === 'number' && value > target;
        return (
          <View key={key} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>{t.nutrients[key]}</Text>
              <Text style={styles.value}>
                {formatMicro(value, unit)}
                <Text style={styles.target}>
                  {' / '}
                  {limit ? `${t.nutrients.max} ` : ''}
                  {formatMicro(target, unit)}
                </Text>
              </Text>
            </View>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  { width: `${share * 100}%` },
                  limit ? styles.fillLimit : styles.fillGood,
                  over && styles.fillOver,
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: { gap: 5 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  label: { color: colors.text, fontSize: 14, fontWeight: '600' },
  value: { color: colors.text, fontSize: 13, fontWeight: '700' },
  target: { color: colors.textMuted, fontWeight: '500' },
  track: { height: 6, borderRadius: radius.full, backgroundColor: colors.border, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
  fillGood: { backgroundColor: '#2E9E6A' },
  fillLimit: { backgroundColor: colors.accent },
  fillOver: { backgroundColor: colors.danger },
});
