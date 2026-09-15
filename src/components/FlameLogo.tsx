import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

// A flame with a heartbeat/pulse line cut through it in white -- calories
// (the flame) and vitality (the pulse) in one mark. Filled with
// colors.accent, the same orange used for "Vault" in the wordmark.
const FLAME_PATH =
  'M50 4 C28 30,16 50,20 76 C23 96,34 118,50 140 C66 118,77 96,80 76 C84 50,72 30,50 4 Z';
const PULSE_PATH = 'M24 92 L36 92 L44 76 L54 60 L63 124 L74 92';

export function LogoGlyph({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size * 1.4} viewBox="0 0 100 140">
      <Path d={FLAME_PATH} fill={colors.accent} />
      <Path
        d={PULSE_PATH}
        fill="none"
        stroke={colors.surface}
        strokeWidth={7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

interface LogoMarkProps {
  size?: number;
}

// The badge treatment used for the app icon/favicon/splash: a rounded
// orange square with a white circle inset, holding the glyph.
export function LogoMark({ size = 96 }: LogoMarkProps) {
  const circleSize = size * 0.72;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.22,
        backgroundColor: colors.accent,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: circleSize,
          height: circleSize,
          borderRadius: circleSize / 2,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LogoGlyph size={circleSize * 0.52} />
      </View>
    </View>
  );
}
