import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../theme';

export type BadgeIcon = (props: { size?: number; color: string; fill?: string }) => React.ReactElement;

// Dark rounded square with an orange-and-white icon -- the same look as the
// Scan logo (LogoScanFrame), so badges across the app read as one set.
export function IconBadge({
  Icon,
  size = 46,
  background = colors.ink,
  accent = colors.accent,
}: {
  Icon: BadgeIcon;
  size?: number;
  background?: string;
  /** Second icon colour next to white; the Premium screen uses orange. */
  accent?: string;
}) {
  return (
    <View
      style={[
        styles.badge,
        { width: size, height: size, borderRadius: size * 0.16, backgroundColor: background },
      ]}
    >
      <Icon size={size * 0.6} color={accent} fill={colors.white} />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignItems: 'center', justifyContent: 'center' },
});
