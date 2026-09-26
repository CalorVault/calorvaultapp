import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../theme';
import { LogFoodTab } from '../navigation/types';
import { LogoScanFrame } from './FlameLogo';
import { MicIcon, PlanDayIcon, SearchIcon } from './NavIcons';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (tab: LogFoodTab, opts?: { autoStartVoice?: boolean }) => void;
}

type IconComponent = (props: { size?: number; color: string }) => React.ReactElement;

// Each option gets its own gradient so the four are easy to tell apart.
const GRADIENTS = {
  voice: [colors.primaryDark, colors.primary],
  search: ['#1D4ED8', '#3B82F6'],
  meal: [colors.primaryDark, '#5A8F6F'],
} as const;

function GradientBadge({
  id,
  from,
  to,
  size,
  Icon,
}: {
  id: string;
  from: string;
  to: string;
  size: number;
  Icon: IconComponent;
}) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
      <View style={styles.badgeIcon}>
        <Icon size={size * 0.5} color={colors.white} />
      </View>
    </View>
  );
}

export function QuickLogSheet({ visible, onClose, onSelect }: Props) {
  const { t } = useApp();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Pressable
            style={({ pressed }) => [styles.voiceCard, pressed && styles.pressed]}
            onPress={() => onSelect('voice', { autoStartVoice: true })}
          >
            <GradientBadge
              id="qlVoice"
              from={GRADIENTS.voice[0]}
              to={GRADIENTS.voice[1]}
              size={48}
              Icon={MicIcon}
            />
            <View style={styles.voiceTextWrap}>
              <Text style={styles.voiceTitle}>{t.quickLog.voiceTitle}</Text>
              <Text style={styles.voiceSubtitle}>{t.quickLog.voiceSubtitle}</Text>
            </View>
          </Pressable>

          <View style={styles.quickRow}>
            <QuickButton
              id="qlSearch"
              gradient={GRADIENTS.search}
              Icon={SearchIcon}
              label={t.quickLog.search}
              onPress={() => onSelect('manual')}
            />
            <QuickButton
              id="qlMeal"
              gradient={GRADIENTS.meal}
              Icon={PlanDayIcon}
              label={t.quickLog.previousMeal}
              onPress={() => onSelect('recent')}
            />
            <QuickButton
              badge={<LogoScanFrame size={46} />}
              label={t.quickLog.scan}
              onPress={() => onSelect('camera')}
            />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function QuickButton({
  id,
  gradient,
  Icon,
  badge,
  label,
  onPress,
}: {
  id?: string;
  gradient?: readonly [string, string];
  Icon?: IconComponent;
  /** Custom badge -- Scan uses the CalorVault logo in a viewfinder, as on the intro screen. */
  badge?: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
      onPress={onPress}
    >
      {badge ??
        (id && gradient && Icon && (
          <GradientBadge id={id} from={gradient[0]} to={gradient[1]} size={46} Icon={Icon} />
        ))}
      <Text style={styles.quickLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: 110,
  },
  sheet: {
    gap: spacing.sm,
  },
  pressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  voiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  badgeIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceTextWrap: { flex: 1 },
  voiceTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  voiceSubtitle: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  quickRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  quickLabel: { color: colors.text, fontSize: 13, fontWeight: '700', textAlign: 'center' },
});
