import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { colors, radius, spacing } from '../theme';
import { WeightEntry } from '../types';

interface Props {
  entries: WeightEntry[];
  label: string;
  maxPoints?: number;
}

const CHART_HEIGHT = 120;
const CHART_PADDING = 16;

export function WeightChart({ entries, label, maxPoints = 10 }: Props) {
  const points = entries.slice(-maxPoints);

  if (points.length === 0) {
    return null;
  }

  const weights = points.map((p) => p.weightKg);
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.current}>{points[points.length - 1].weightKg} kg</Text>
      </View>
      <View style={styles.svgWrap}>
        <ChartSvg points={points} min={min} range={range} />
      </View>
      <View style={styles.axisRow}>
        <Text style={styles.axisLabel}>
          {formatShortDate(points[0].date)}
        </Text>
        <Text style={styles.axisLabel}>
          {formatShortDate(points[points.length - 1].date)}
        </Text>
      </View>
    </View>
  );
}

function ChartSvg({
  points,
  min,
  range,
}: {
  points: WeightEntry[];
  min: number;
  range: number;
}) {
  const width = 320;
  const innerHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const innerWidth = width - CHART_PADDING * 2;

  const coords = points.map((p, i) => {
    const x =
      points.length === 1
        ? CHART_PADDING + innerWidth / 2
        : CHART_PADDING + (i / (points.length - 1)) * innerWidth;
    const y = CHART_PADDING + innerHeight - ((p.weightKg - min) / range) * innerHeight;
    return { x, y };
  });

  const polylinePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');

  return (
    <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${width} ${CHART_HEIGHT}`}>
      <Line
        x1={CHART_PADDING}
        y1={CHART_PADDING + innerHeight}
        x2={width - CHART_PADDING}
        y2={CHART_PADDING + innerHeight}
        stroke={colors.border}
        strokeWidth={1}
      />
      {coords.length > 1 && (
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={colors.accent}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {coords.map((c, i) => (
        <Circle key={i} cx={c.x} cy={c.y} r={i === coords.length - 1 ? 4.5 : 3} fill={colors.accent} />
      ))}
    </Svg>
  );
}

function formatShortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  current: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  svgWrap: {
    width: '100%',
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  axisLabel: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
