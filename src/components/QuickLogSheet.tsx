import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
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

type IconComponent = (props: { size?: number; color: string; fill?: string }) => React.ReactElement;

const BADGE_SIZE = 46;

// Dark rounded square with an orange-and-white icon, the same look as the
// Scan logo (LogoScanFrame) so all four options read as one set.
function DarkBadge({ Icon, background = colors.ink }: { Icon: IconComponent; background?: string }) {
  return (
    <View
      style={[
        styles.darkBadge,
        {
          width: BADGE_SIZE,
          height: BADGE_SIZE,
          borderRadius: BADGE_SIZE * 0.16,
          backgroundColor: background,
        },
      ]}
    >
      <Icon size={BADGE_SIZE * 0.6} color={colors.accent} fill={colors.white} />
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
            <DarkBadge Icon={MicIcon} background={VOICE_BADGE_BG} />
            <View style={styles.voiceTextWrap}>
              <Text style={styles.voiceTitle}>{t.quickLog.voiceTitle}</Text>
              <Text style={styles.voiceSubtitle}>{t.quickLog.voiceSubtitle}</Text>
            </View>
            <Text style={styles.voiceChevron}>›</Text>
          </Pressable>

          <View style={styles.quickRow}>
            <QuickButton
              badge={<DarkBadge Icon={SearchIcon} />}
              label={t.quickLog.search}
              onPress={() => onSelect('manual')}
            />
            <QuickButton
              badge={<DarkBadge Icon={PlanDayIcon} />}
              label={t.quickLog.previousMeal}
              onPress={() => onSelect('recent')}
            />
            <QuickButton
              badge={<LogoScanFrame size={BADGE_SIZE} glyphScale={0.38} />}
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
  badge,
  label,
  onPress,
}: {
  badge: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.quickButton, pressed && styles.pressed]}
      onPress={onPress}
    >
      {badge}
      <Text style={styles.quickLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

// Voice to Meal is the headline option, so its card is dark like the badges
// and the mic sits straight on it.
const VOICE_CARD_BG = colors.ink;
const VOICE_BADGE_BG = 'transparent';

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
    backgroundColor: VOICE_CARD_BG,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  darkBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceTextWrap: { flex: 1 },
  voiceTitle: { color: colors.white, fontSize: 17, fontWeight: '700' },
  voiceSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  voiceChevron: { color: colors.accent, fontSize: 30, fontWeight: '600', marginTop: -2 },
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
