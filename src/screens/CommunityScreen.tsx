import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommunityIcon, SettingsIcon } from '../components/NavIcons';
import { useApp } from '../context/AppContext';
import { RecipesScreenNavigationProp } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

export function CommunityScreen() {
  const navigation = useNavigation<RecipesScreenNavigationProp>();
  const { t } = useApp();

  return (
    <SafeAreaView style={styles.flex} edges={['top']}>
      <View style={styles.topBar}>
        <View style={styles.titleRow}>
          <CommunityIcon size={26} color={colors.text} />
          <Text style={styles.title}>{t.community.title}</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.settingsButton, pressed && styles.pressedDim]}
          onPress={() => navigation.navigate('Settings')}
          hitSlop={8}
          accessibilityLabel={t.common.settings}
          accessibilityRole="button"
        >
          <SettingsIcon size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <CommunityIcon size={40} color={colors.textMuted} />
        </View>
        <Text style={styles.heading}>{t.community.comingSoon}</Text>
        <Text style={styles.copy}>{t.community.copy}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pressedDim: { opacity: 0.6 },
  flex: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  heading: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  copy: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
