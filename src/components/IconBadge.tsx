import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';
import { GradientCard } from './GradientCard';

export type BadgeIcon = (props: { size?: number; color: string; fill?: string }) => React.ReactElement;

// Dark rounded square with an orange-and-white icon -- the same look as the
// Scan logo (LogoScanFrame), so badges across the app read as one set. By
// default the square has the same dark-to-slate shading as the dark cards;
// pass `background` for a flat colour (e.g. on top of a card that's already shaded).
export function IconBadge({
  Icon,
  size = 46,
  background,
  accent = colors.accent,
}: {
  Icon: BadgeIcon;
  size?: number;
  background?: string;
  /** Second icon colour next to white; the Premium screen uses orange. */
  accent?: string;
}) {
  const frame = { width: size, height: size, borderRadius: size * 0.16 };
  // Wrapped so the icon always stacks above the gradient layer.
  const icon = (
    <View>
      <Icon size={size * 0.6} color={accent} fill={colors.white} />
    </View>
  );
  return background === undefined ? (
    <GradientCard style={[styles.badge, frame]}>{icon}</GradientCard>
  ) : (
    <View style={[styles.badge, frame, { backgroundColor: background }]}>{icon}</View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
