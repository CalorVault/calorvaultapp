import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LogoScanFrame } from '../components/FlameLogo';
import { colors } from '../theme';

interface Props {
  onFinish: () => void;
}

const ICON_SLIDE_MS = 550;
const HOLD_AFTER_ICON_MS = 200;
const TEXT_SLIDE_MS = 480;
const CLASH_MS = 150;
const HOLD_MS = 700;
const FADE_MS = 300;

// LogoScanFrame is a square of exactly `size`. Resting it at -half its
// height moves it up so its *bottom* edge lands on the screen's vertical
// middle, instead of its center.
const ICON_SIZE = 132;
const ICON_REST_Y = -ICON_SIZE / 2;
const TEXT_GAP = 20;

export function IntroScreen({ onFinish }: Props) {
  const iconTranslateY = useRef(new Animated.Value(380)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const calorTranslateX = useRef(new Animated.Value(-260)).current;
  const vaultTranslateX = useRef(new Animated.Value(260)).current;
  const clashScale = useRef(new Animated.Value(1)).current;
  const groupOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      // The icon slides up from below the screen, on its own.
      Animated.parallel([
        Animated.timing(iconTranslateY, {
          toValue: ICON_REST_Y,
          duration: ICON_SLIDE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: ICON_SLIDE_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(HOLD_AFTER_ICON_MS),
      // "Calor" comes in from the left, "Vault" from the right, and they
      // clash together in the middle to form the full wordmark.
      Animated.parallel([
        Animated.timing(calorTranslateX, {
          toValue: 0,
          duration: TEXT_SLIDE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(vaultTranslateX, {
          toValue: 0,
          duration: TEXT_SLIDE_MS,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // A quick impact bounce right as they collide.
      Animated.sequence([
        Animated.timing(clashScale, {
          toValue: 1.12,
          duration: CLASH_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(clashScale, {
          toValue: 1,
          duration: CLASH_MS,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(HOLD_MS),
      Animated.timing(groupOpacity, {
        toValue: 0,
        duration: FADE_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onFinish();
    });
    // Runs once on mount -- animated values are stable for the lifetime of
    // this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: groupOpacity }]}>
        {/* Its own full-screen centering layer, so the icon's rest position
            is the exact vertical middle of the screen -- independent of
            whatever the wordmark below ends up taking up. */}
        <View style={styles.iconLayer}>
          <Animated.View
            style={{ opacity: iconOpacity, transform: [{ translateY: iconTranslateY }] }}
          >
            <LogoScanFrame size={ICON_SIZE} />
          </Animated.View>
        </View>

        <View style={styles.textLayer}>
          <Animated.View style={[styles.wordmarkRow, { transform: [{ scale: clashScale }] }]}>
            <Animated.Text
              style={[
                styles.wordmark,
                styles.wordmarkCalor,
                { transform: [{ translateX: calorTranslateX }] },
              ]}
            >
              Calor
            </Animated.Text>
            <Animated.Text
              style={[
                styles.wordmark,
                styles.wordmarkVault,
                { transform: [{ translateX: vaultTranslateX }] },
              ]}
            >
              Vault
            </Animated.Text>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    zIndex: 10,
    overflow: 'hidden',
  },
  iconLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textLayer: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: TEXT_GAP,
  },
  wordmarkRow: {
    flexDirection: 'row',
  },
  wordmark: {
    fontSize: 36,
    fontWeight: '800',
  },
  wordmarkCalor: {
    color: colors.ink,
  },
  wordmarkVault: {
    color: colors.accent,
  },
});
