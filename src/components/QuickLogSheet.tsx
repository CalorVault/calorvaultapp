import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../context/AppContext';
import { colors, radius, spacing } from '../theme';
import { LogFoodTab } from '../navigation/types';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (tab: LogFoodTab, opts?: { autoStartVoice?: boolean }) => void;
}

export function QuickLogSheet({ visible, onClose, onSelect }: Props) {
  const { t } = useApp();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.sheet}>
          <Pressable
            style={styles.voiceCard}
            onPress={() => onSelect('voice', { autoStartVoice: true })}
          >
            <View style={styles.voiceIconWrap}>
              <Text style={styles.voiceIcon}>🎙️</Text>
            </View>
            <View style={styles.voiceTextWrap}>
              <Text style={styles.voiceTitle}>{t.quickLog.voiceTitle}</Text>
              <Text style={styles.voiceSubtitle}>{t.quickLog.voiceSubtitle}</Text>
            </View>
          </Pressable>

          <View style={styles.quickRow}>
            <QuickButton icon="🍽️" label={t.quickLog.previousMeal} onPress={() => onSelect('recent')} />
            <QuickButton icon="🔍" label={t.quickLog.search} onPress={() => onSelect('manual')} />
            <QuickButton icon="⛶" label={t.quickLog.scan} onPress={() => onSelect('camera')} />
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

function QuickButton({
  icon,
  label,
  onPress,
}: {
  icon: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.quickButton} onPress={onPress}>
      <Text style={styles.quickIcon}>{icon}</Text>
      <Text style={styles.quickLabel}>{label}</Text>
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
  voiceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceIcon: { fontSize: 22 },
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
    paddingVertical: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  quickIcon: { fontSize: 24 },
  quickLabel: { color: colors.text, fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
