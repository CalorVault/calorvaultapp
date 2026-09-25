import React, { useState } from 'react';
import { LayoutChangeEvent, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Text as SvgText } from 'react-native-svg';
import { colors, radius, spacing } from '../theme';
import { Goal, WeightEntry } from '../types';

const PANEL = {
  card: colors.surface,
  grid: '#EDEEF1',
  text: colors.ink,
  muted: colors.textMuted,
  good: colors.primary,
  bad: colors.danger,
}
const PLOT_HEIGHT = 130;
const PAD_Y = 12;
const AXIS_WIDTH = 44;
const AXIS_FONT = Platform.OS === 'web' ? 'sans-serif' : undefined;

export interface WeightChartLabels {
  title: string;
  lost: string;
  gained: string;
  fromStart: string;
  needMore: string;
}

interface Props {
  entries: WeightEntry[];
  goal: Goal;
  labels: WeightChartLabels;
  maxPoints?: number;
}

// "Progress" is plotted so that moving toward your goal always goes up:
// kg lost when cutting, kg gained when bulking or building muscle. When
// maintaining there's no direction to reward, so it shows the plain change.
function progressOf(goal: Goal, start: number, weight: number): number {
  if (goal === 'lose') return start - weight;
  if (goal === 'gain' || goal === 'build_muscle') return weight - start;
  return weight - start;
}

function niceStep(range: number): number {
  const raw = range / 2;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= raw) return m * exp;
  return 10 * exp;
}

function fmtKg(v: number): string {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? '+' : ''}${r}`;
}

function formatShortDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function WeightChart({ entries, goal, labels, maxPoints = 30 }: Props) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  if (entries.length === 0) return null;

  const start = entries[0].weightKg;
  const points = entries.slice(-maxPoints);
  const current = points[points.length - 1].weightKg;
  const values = points.map((p) => progressOf(goal, start, p.weightKg));
  const latest = values[values.length - 1];
  const directional = goal !== 'maintain';
  const onTrack = !directional || latest >= 0;
  const changeKg = Math.round(Math.abs(current - start) * 10) / 10;

  let summary: string;
  if (!directional) summary = `${fmtKg(current - start)} kg ${labels.fromStart}`;
  else if (current <= start) summary = `${labels.lost} ${changeKg} kg`;
  else summary = `${labels.gained} ${changeKg} kg`;

  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const step = niceStep(Math.max(hi - lo, 1));
  const yMin = Math.floor(lo / step) * step;
  const yMax = Math.max(Math.ceil(hi / step) * step, yMin + step);
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(Math.round(v * 10) / 10);

  const plotW = Math.max(0, width - AXIS_WIDTH);
  const y = (v: number) => PAD_Y + PLOT_HEIGHT - ((v - yMin) / (yMax - yMin)) * PLOT_HEIGHT;
  const x = (i: number) =>
    AXIS_WIDTH + (points.length === 1 ? plotW / 2 : 8 + (i / (points.length - 1)) * (plotW - 16));
  const coords = values.map((v, i) => ({ x: x(i), y: y(v), v }));
  const lineColor = onTrack ? PANEL.good : PANEL.bad;
  const pointColor = (v: number) => (!directional || v >= 0 ? PANEL.good : PANEL.bad);
  const area =
    coords.length > 1
      ? `M${coords[0].x},${y(0)} ` +
        coords.map((c) => `L${c.x},${c.y}`).join(' ') +
        ` L${coords[coords.length - 1].x},${y(0)} Z`
      : '';

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{labels.title}</Text>
        <View style={styles.headerRight}>
          <Text style={styles.current}>{current} kg</Text>
          <Text style={[styles.summary, { color: onTrack ? PANEL.good : PANEL.bad }]}>{summary}</Text>
        </View>
      </View>
      <View onLayout={onLayout}>
        {width > 0 && (
          <Svg width={width} height={PLOT_HEIGHT + PAD_Y * 2}>
            {ticks.map((v) => (
              <React.Fragment key={v}>
                <Line
                  x1={AXIS_WIDTH}
                  x2={width}
                  y1={y(v)}
                  y2={y(v)}
                  stroke={v === 0 ? PANEL.text : PANEL.grid}
                  strokeWidth={v === 0 ? 1.5 : 1}
                  opacity={v === 0 ? 0.6 : 1}
                />
                <SvgText
                  x={AXIS_WIDTH - 6}
                  y={y(v) + 4}
                  fontSize={11}
                  fontFamily={AXIS_FONT}
                  fill={PANEL.muted}
                  textAnchor="end"
                >
                  {v === 0 ? '0' : `${fmtKg(v)}kg`}
                </SvgText>
              </React.Fragment>
            ))}
            {area ? <Path d={area} fill={lineColor} opacity={0.12} /> : null}
            {coords.length > 1 && (
              <Polyline
                points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
            {coords.map((c, i) => {
              const last = i === coords.length - 1;
              return (
                <Circle
                  key={i}
                  cx={c.x}
                  cy={c.y}
                  r={last ? 5 : 3}
                  fill={pointColor(c.v)}
                  stroke={PANEL.card}
                  strokeWidth={2}
                />
              );
            })}
          </Svg>
        )}
      </View>
      {points.length > 1 ? (
        <View style={styles.axisRow}>
          <Text style={styles.axisLabel}>{formatShortDate(points[0].date)}</Text>
          <Text style={styles.axisLabel}>{formatShortDate(points[points.length - 1].date)}</Text>
        </View>
      ) : (
        <Text style={styles.axisLabel}>{labels.needMore}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: PANEL.card,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { color: PANEL.text, fontSize: 17, fontWeight: '700' },
  headerRight: { alignItems: 'flex-end', gap: 2 },
  current: { color: PANEL.text, fontSize: 18, fontWeight: '700' },
  summary: { fontSize: 12, fontWeight: '700' },
  axisRow: { flexDirection: 'row', justifyContent: 'space-between', paddingLeft: AXIS_WIDTH },
  axisLabel: { color: PANEL.muted, fontSize: 11 },
});
