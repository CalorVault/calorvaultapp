import { RouteProp, useRoute } from '@react-navigation/native';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ShareDayCard } from '../components/ShareDayCard';
import { useApp } from '../context/AppContext';
import { captureAndShareCard } from '../lib/shareCard';
import { RootStackParamList } from '../navigation/types';
import { colors, radius, spacing } from '../theme';

export function ShareDayScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ShareDay'>>();
  const { t } = useApp();
  const cardRef = useRef(null);
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    setSharing(true);
    try {
      await captureAndShareCard(cardRef);
    } catch (err) {
      Alert.alert(t.shareCard.shareFailedTitle, err instanceof Error ? err.message : String(err));
    } finally {
      setSharing(false);
    }
  }

  return (
    <View style={styles.flex}>
      <Text style={styles.title}>{t.shareCard.title}</Text>
      <View style={styles.cardWrap}>
        <View ref={cardRef} collapsable={false}>
          <ShareDayCard {...route.params} />
        </View>
      </View>
      <Pressable
        style={({ pressed }) => [styles.shareButton, pressed && styles.pressedDim]}
        onPress={handleShare}
        disabled={sharing}
      >
        {sharing ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.shareButtonText}>{t.shareCard.shareButton}</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pressedDim: { opacity: 0.6 },
  flex: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  cardWrap: {
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  shareButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl * 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 200,
  },
  shareButtonText: { color: colors.background, fontWeight: '700', fontSize: 16 },
});
