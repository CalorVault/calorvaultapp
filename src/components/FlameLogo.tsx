import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

// A flame with a heartbeat/pulse line cut through it in white -- calories
// (the flame) and vitality (the pulse) in one mark. Filled with
// colors.accent, the same orange used for "Vault" in the wordmark.
const FLAME_PATH =
  'M50 4 C28 30,16 50,20 76 C23 96,34 118,50 140 C66 118,77 96,80 76 C84 50,72 30,50 4 Z';
const PULSE_PATH = 'M28 92 L36 92 L44 76 L54 60 L57 124 L72 92';

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

interface LogoScanFrameProps {
  size?: number;
  /** Glyph width as a fraction of `size`; small badges use a larger share so the leaf stays legible. */
  glyphScale?: number;
  background?: string;
}

// Wraps the unchanged logo glyph in a dark square with camera-viewfinder
// corner brackets, for a "scanning" presentation -- the glyph itself is
// untouched, only the frame around it is new.
export function LogoScanFrame({
  size = 160,
  glyphScale = 0.28,
  background = colors.ink,
}: LogoScanFrameProps) {
  const cornerLength = size * 0.16;
  const cornerThickness = Math.max(2, size * 0.028);
  const inset = size * 0.14;
  const cornerStyle = {
    position: 'absolute' as const,
    width: cornerLength,
    height: cornerLength,
    borderColor: colors.surface,
  };

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.16,
        backgroundColor: background,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={[
          cornerStyle,
          {
            top: inset,
            left: inset,
            borderTopWidth: cornerThickness,
            borderLeftWidth: cornerThickness,
            borderTopLeftRadius: cornerThickness * 1.5,
          },
        ]}
      />
      <View
        style={[
          cornerStyle,
          {
            top: inset,
            right: inset,
            borderTopWidth: cornerThickness,
            borderRightWidth: cornerThickness,
            borderTopRightRadius: cornerThickness * 1.5,
          },
        ]}
      />
      <View
        style={[
          cornerStyle,
          {
            bottom: inset,
            left: inset,
            borderBottomWidth: cornerThickness,
            borderLeftWidth: cornerThickness,
            borderBottomLeftRadius: cornerThickness * 1.5,
          },
        ]}
      />
      <View
        style={[
          cornerStyle,
          {
            bottom: inset,
            right: inset,
            borderBottomWidth: cornerThickness,
            borderRightWidth: cornerThickness,
            borderBottomRightRadius: cornerThickness * 1.5,
          },
        ]}
      />
      <LogoGlyph size={size * glyphScale} />
    </View>
  );
}
