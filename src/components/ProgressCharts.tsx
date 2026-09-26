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
  /** Set on weekly groups (30-day view): how many days in the group hit all 3 goals. */
  hitCount?: number;
  /** Set on weekly groups: the date range the group covers, for the detail row. */
  spanLabel?: string;
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

export const PANEL = {
  card: colors.surface,
  tile: colors.surfaceAlt,
  grid: '#EDEEF1',
  text: colors.ink,
  muted: colors.textMuted,
  track: 0.14,
  bar: colors.accent,
  input: colors.surfaceAlt,
}

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

function Axes({ g, width, days, dark }: { g: Geometry; width: number; days: DayMacros[]; dark?: boolean }) {
  const gridColor = dark ? PANEL.grid : GRID;
  const labelColor = dark ? PANEL.muted : colors.textMuted;
  const every = xLabelEvery(days.length);
  return (
    <G>
      {g.ticks.map((tick) => (
        <G key={tick}>
          <Line x1={AXIS_WIDTH} x2={width} y1={g.y(tick)} y2={g.y(tick)} stroke={gridColor} strokeWidth={1} />
          <SvgText
            x={AXIS_WIDTH - 8}
            y={g.y(tick) + 4}
            fontSize={11}
            fontFamily={AXIS_FONT}
            fill={labelColor}
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
            fill={labelColor}
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

export function CaloriesChart({
  days,
  target,
  selectedDate,
  onSelect,
  dark,
}: ChartProps & { target: number; dark?: boolean }) {
  const { width, onLayout } = useWidth();
  const g = geometry(width, days.length, Math.max(target, ...days.map((d) => d.calories)));
  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={TOP_PAD + PLOT_HEIGHT + X_LABEL_HEIGHT}>
          <Axes g={g} width={width} days={days} dark={dark} />
          {days.map((d, i) => {
            const x = AXIS_WIDTH + g.slot * i + (g.slot - g.barW) / 2;
            const dim = selectedDate !== null && selectedDate !== d.date;
            return (
              <Path
                key={d.date}
                d={columnPath(x, g.y(d.calories), g.barW, g.y(0), true)}
                fill={dark ? PANEL.bar : colors.accent}
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
                stroke={dark ? PANEL.text : colors.ink}
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

// ---- Macros vs goal (dark card) --------------------------------------------

const GOAL_PLOT = 150;
const GOAL_TOP = 8;
// A macro counts as "hit" at 90% of its target; a cap marks going 5%+ over.
export const HIT_RATIO = 0.9;
const OVER_RATIO = 1.05;

export interface MacroTargets {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export function hitAllGoals(d: DayMacros, targets: MacroTargets): boolean {
  return d.hasEntries && MACRO_ORDER.every((m) => d[m.key] >= targets[m.key] * HIT_RATIO);
}

export function MacroGoalChart({
  days,
  targets,
  todayDate,
  selectedDate,
  onSelect,
  todayLabel,
}: ChartProps & { targets: MacroTargets; todayDate: string; todayLabel: string }) {
  const { width, onLayout } = useWidth();
  const ax = 36;
  const slot = days.length ? (width - ax) / days.length : 0;
  const gap = days.length > 7 ? 1 : 3;
  const tw = Math.max(2, Math.min(10, (slot - 6 - gap * 2) / 3));
  const y = (v: number) => GOAL_TOP + GOAL_PLOT - v * GOAL_PLOT;
  const every = xLabelEvery(days.length);
  const height = GOAL_TOP + GOAL_PLOT + 44;

  return (
    <View onLayout={onLayout}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {days.map((d, i) =>
            d.date === selectedDate ? (
              <Rect
                key="sel"
                x={ax + slot * i + 1}
                y={GOAL_TOP - 6}
                width={slot - 2}
                height={GOAL_PLOT + 30}
                rx={6}
                fill={PANEL.tile}
              />
            ) : null
          )}
          {[0, 0.5, 1].map((v) => (
            <G key={v}>
              <Line
                x1={ax}
                x2={width}
                y1={y(v)}
                y2={y(v)}
                stroke={v === 1 ? PANEL.text : PANEL.grid}
                strokeWidth={v === 1 ? 1.5 : 1}
                opacity={v === 1 ? 0.6 : 1}
              />
              <SvgText
                x={ax - 6}
                y={y(v) + 4}
                fontSize={11}
                fontFamily={AXIS_FONT}
                fill={PANEL.muted}
                textAnchor="end"
              >
                {`${v * 100}%`}
              </SvgText>
            </G>
          ))}
          {days.map((d, i) => {
            const cx = ax + slot * i + slot / 2;
            const x0 = cx - (3 * tw + 2 * gap) / 2;
            const isToday = d.date === todayDate;
            const emphasised = isToday || d.date === selectedDate;
            const showLabel = days.length <= 7 || i % every === 0 || i === days.length - 1;
            return (
              <G key={d.date}>
                {MACRO_ORDER.map((m, j) => {
                  const x = x0 + j * (tw + gap);
                  const ratio = targets[m.key] > 0 ? d[m.key] / targets[m.key] : 0;
                  const h = Math.min(ratio, 1) * GOAL_PLOT;
                  return (
                    <G key={m.key}>
                      <Rect x={x} y={GOAL_TOP} width={tw} height={GOAL_PLOT} fill={m.color} opacity={PANEL.track} />
                      {d.hasEntries && h > 0 && (
                        <Rect x={x} y={GOAL_TOP + GOAL_PLOT - h} width={tw} height={h} fill={m.color} />
                      )}
                      {d.hasEntries && ratio > OVER_RATIO && (
                        <Rect x={x} y={GOAL_TOP - 5} width={tw} height={3} fill={PANEL.text} />
                      )}
                    </G>
                  );
                })}
                {showLabel && (
                  <SvgText
                    x={cx}
                    y={GOAL_TOP + GOAL_PLOT + 17}
                    fontSize={11}
                    fontFamily={AXIS_FONT}
                    fontWeight={emphasised ? '700' : '500'}
                    fill={emphasised ? PANEL.text : PANEL.muted}
                    textAnchor="middle"
                  >
                    {isToday && d.hitCount === undefined ? todayLabel : d.axisLabel}
                  </SvgText>
                )}
                {d.hitCount !== undefined ? (
                  d.hitCount > 0 && (
                    <SvgText
                      x={cx}
                      y={GOAL_TOP + GOAL_PLOT + 37}
                      fontSize={11}
                      fontWeight="700"
                      fontFamily={AXIS_FONT}
                      fill={colors.primary}
                      textAnchor="middle"
                    >
                      {`✓ ${d.hitCount}`}
                    </SvgText>
                  )
                ) : hitAllGoals(d, targets) && (
                  <G>
                    <Rect
                      x={cx - Math.min(7, slot / 2 - 1)}
                      y={GOAL_TOP + GOAL_PLOT + 26}
                      width={Math.min(14, slot - 2)}
                      height={14}
                      rx={3}
                      fill={colors.primary}
                    />
                    {slot >= 12 && (
                      <SvgText
                        x={cx}
                        y={GOAL_TOP + GOAL_PLOT + 37}
                        fontSize={10}
                        fontWeight="700"
                        fontFamily={AXIS_FONT}
                        fill={colors.white}
                        textAnchor="middle"
                      >
                        ✓
                      </SvgText>
                    )}
                  </G>
                )}
                <Rect
                  x={ax + slot * i}
                  y={0}
                  width={slot}
                  height={height}
                  fill="transparent"
                  onPress={() => onSelect(d.date)}
                />
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

export function PanelLegendItem({ color, label, percent }: { color: string; label: string; percent: number }) {
  return (
    <View style={panelStyles.legendItem}>
      <View style={panelStyles.legendKey}>
        <View style={[panelStyles.swatch, { backgroundColor: color }]} />
        <Text style={panelStyles.legendLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={panelStyles.legendValue}>{percent}%</Text>
    </View>
  );
}

export const panelStyles = StyleSheet.create({
  card: {
    backgroundColor: PANEL.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { color: PANEL.text, fontSize: 17, fontWeight: '700' },
  meta: { color: PANEL.muted, fontSize: 12, fontWeight: '600' },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between' },
  legendItem: { flex: 1, gap: 2 },
  legendKey: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendLabel: { color: PANEL.muted, fontSize: 12, fontWeight: '600' },
  legendValue: { color: PANEL.text, fontSize: 20, fontWeight: '700' },
  detail: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: PANEL.grid,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  detailDate: { color: PANEL.text, fontSize: 13, fontWeight: '700', minWidth: 56 },
  detailValues: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  detailValue: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  detailText: { color: PANEL.text, fontSize: 12 },
  openDay: { backgroundColor: PANEL.text, borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: 10 },
  openDayText: { color: PANEL.card, fontWeight: '700', fontSize: 12 },
  hint: { color: PANEL.muted, fontSize: 11 },
});
