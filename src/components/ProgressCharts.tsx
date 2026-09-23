import React, { useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { colors, radius, spacing } from '../theme';

export interface DayMacros {
  date: string;
  /** Short label for the x-axis, e.g. "Mon" or "12". */
  axisLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  hasEntries: boolean;
}

// Stack and legend order. Protein and carbs (rose and orange) are too close
// to sit side by side, so fat (blue) always goes between them.
export const MACRO_ORDER = [
  { key: 'proteinG', color: colors.protein },
  { key: 'fatG', color: colors.fat },
  { key: 'carbsG', color: colors.carbs },
] as const;

const PLOT_HEIGHT = 160;
const AXIS_WIDTH = 40;
const X_LABEL_HEIGHT = 20;
const GRID = '#EDEEF1';
const GAP = 2;
const TOP_PAD = 10;
// react-native-svg falls back to a serif face on web; iOS uses the system font.
const AXIS_FONT = Platform.OS === 'web' ? 'sans-serif' : undefined;

function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(value)));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    if (m * exp >= value) return m * exp;
  }
  return 10 * exp;
}

// Column with a 4px rounded data-end and a square base, per the chart specs.
function columnPath(x: number, yTop: number, width: number, yBase: number, roundTop: boolean): string {
  const h = yBase - yTop;
  if (h <= 0) return '';
  const r = roundTop ? Math.min(4, width / 2, h) : 0;
  return [
    `M${x},${yBase}`,
    `L${x},${yTop + r}`,
    r ? `Q${x},${yTop} ${x + r},${yTop}` : '',
    `L${x + width - r},${yTop}`,
    r ? `Q${x + width},${yTop} ${x + width},${yTop + r}` : '',
    `L${x + width},${yBase}`,
    'Z',
  ].join(' ');
}

function useWidth() {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  return { width, onLayout };
}

function xLabelEvery(n: number): number {
  return n <= 7 ? 1 : n <= 14 ? 2 : 5;
}

interface ChartProps {
  days: DayMacros[];
  selectedDate: string | null;
  onSelect: (date: string) => void;
}

interface Geometry {
  plotW: number;
  slot: number;
  barW: number;
  yMax: number;
  ticks: number[];
  y: (v: number) => number;
}

function geometry(width: number, n: number, maxValue: number): Geometry {
  const plotW = Math.max(0, width - AXIS_WIDTH);
  const slot = n > 0 ? plotW / n : 0;
  const barW = Math.max(3, Math.min(24, slot * 0.6));
  const yMax = niceMax(maxValue);
  const ticks = [0, yMax / 2, yMax];
  const y = (v: number) => TOP_PAD + PLOT_HEIGHT - (v / yMax) * PLOT_HEIGHT;
  return { plotW, slot, barW, yMax, ticks, y };
}

function formatTick(v: number): string {
  return v >= 1000 ? `${(v / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : String(Math.round(v));
}

function Axes({ g, width, days }: { g: Geometry; width: number; days: DayMacros[] }) {
  const every = xLabelEvery(days.length);
  return (
    <G>
      {g.ticks.map((tick) => (
        <G key={tick}>
          <Line x1={AXIS_WIDTH} x2={width} y1={g.y(tick)} y2={g.y(tick)} stroke={GRID} strokeWidth={1} />
          <SvgText
            x={AXIS_WIDTH - 8}
            y={g.y(tick) + 4}
            fontSize={11}
            fontFamily={AXIS_FONT}
            fill={colors.textMuted}
            textAnchor="end"
          >
            {formatTick(tick)}
          </SvgText>
        </G>
      ))}
      {days.map((d, i) =>
        i % every === 0 || i === days.length - 1 ? (
          <SvgText
            key={d.date}
            x={AXIS_WIDTH + g.slot * i + g.slot / 2}
            y={TOP_PAD + PLOT_HEIGHT + 15}
            fontSize={11}
            fontFamily={AXIS_FONT}
            fill={colors.textMuted}
            textAnchor="middle"
          >
            {d.axisLabel}
          </SvgText>
        ) : null
      )}
    </G>
  );
}

function HitTargets({ g, days, onSelect }: { g: Geometry; days: DayMacros[]; onSelect: (d: string) => void }) {
  return (
    <G>
      {days.map((d, i) => (
        <Rect
          key={d.date}
          x={AXIS_WIDTH + g.slot * i}
          y={0}
          width={g.slot}
          height={TOP_PAD + PLOT_HEIGHT + X_LABEL_HEIGHT}
          fill="transparent"
          onPress={() => onSelect(d.date)}
        />
      ))}
    </G>
  );
}

export function CaloriesChart({ days, target, selectedDate, onSelect }: ChartProps & { target: number }) {
  const { width, onLayout } = useWidth();
  const g = geometry(width, days.length, Math.max(target, ...days.map((d) => d.calories)));
  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={TOP_PAD + PLOT_HEIGHT + X_LABEL_HEIGHT}>
          <Axes g={g} width={width} days={days} />
          {days.map((d, i) => {
            const x = AXIS_WIDTH + g.slot * i + (g.slot - g.barW) / 2;
            const dim = selectedDate !== null && selectedDate !== d.date;
            return (
              <Path
                key={d.date}
                d={columnPath(x, g.y(d.calories), g.barW, g.y(0), true)}
                fill={colors.primary}
                opacity={dim ? 0.3 : 1}
              />
            );
          })}
          {target > 0 && (
            <G>
              <Line
                x1={AXIS_WIDTH}
                x2={width}
                y1={g.y(target)}
                y2={g.y(target)}
                stroke={colors.ink}
                strokeWidth={1.5}
                opacity={0.55}
              />
            </G>
          )}
          <HitTargets g={g} days={days} onSelect={onSelect} />
        </Svg>
      )}
    </View>
  );
}

export function MacroStackChart({ days, selectedDate, onSelect }: ChartProps) {
  const { width, onLayout } = useWidth();
  const totals = days.map((d) => d.proteinG + d.fatG + d.carbsG);
  const g = geometry(width, days.length, Math.max(...totals, 1));
  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={TOP_PAD + PLOT_HEIGHT + X_LABEL_HEIGHT}>
          <Axes g={g} width={width} days={days} />
          {days.map((d, i) => {
            const x = AXIS_WIDTH + g.slot * i + (g.slot - g.barW) / 2;
            const dim = selectedDate !== null && selectedDate !== d.date;
            const present = MACRO_ORDER.filter((m) => d[m.key] > 0);
            let base = g.y(0);
            return (
              <G key={d.date} opacity={dim ? 0.3 : 1}>
                {present.map((m, idx) => {
                  const h = (d[m.key] / g.yMax) * PLOT_HEIGHT;
                  const isTop = idx === present.length - 1;
                  // 2px surface gap between stacked segments.
                  const top = base - h;
                  const drawBase = base;
                  base = top;
                  const segTop = isTop ? top : top + GAP;
                  return (
                    <Path
                      key={m.key}
                      d={columnPath(x, segTop, g.barW, drawBase, isTop)}
                      fill={m.color}
                    />
                  );
                })}
              </G>
            );
          })}
          <HitTargets g={g} days={days} onSelect={onSelect} />
        </Svg>
      )}
    </View>
  );
}

export function MacroMeter({
  label,
  color,
  value,
  target,
}: {
  label: string;
  color: string;
  value: number;
  target: number;
}) {
  const pct = target > 0 ? Math.min(1, value / target) : 0;
  return (
    <View style={styles.meter}>
      <View style={styles.meterHeader}>
        <View style={styles.meterKey}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
          <Text style={styles.meterLabel}>{label}</Text>
        </View>
        <Text style={styles.meterValue}>
          {Math.round(value)}g <Text style={styles.meterTarget}>/ {target}g</Text>
        </Text>
      </View>
      <View style={[styles.meterTrack, { backgroundColor: `${color}22` }]}>
        <View style={[styles.meterFill, { width: `${pct * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export function LegendItem({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLabel: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  legendValue: { color: colors.text, fontSize: 12, fontWeight: '700' },
  meter: { gap: 6 },
  meterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  meterKey: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  meterLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
  meterValue: { color: colors.text, fontSize: 14, fontWeight: '700' },
  meterTarget: { color: colors.textMuted, fontWeight: '500' },
  meterTrack: { height: 10, borderRadius: radius.full, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: radius.full },
});

export const chartStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
});
