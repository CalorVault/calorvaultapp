import React, { useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';

// Black with a hint of slate, used with orange accents to match the logo.
export const BLACK_GRADIENT = [colors.ink, '#1A2231', '#232C3D'] as const;

let gradientCounter = 0;

/**
 * A View with a diagonal gradient behind its children. The gradient is drawn
 * at the measured size because percentage sizes don't fill on iOS.
 */
export function GradientCard({
  style,
  children,
  stops = BLACK_GRADIENT,
}: {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  stops?: readonly string[];
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const [id] = useState(() => `gradientCard${gradientCounter++}`);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size?.width || height !== size?.height) setSize({ width, height });
  }

  return (
    <View style={[styles.card, style]} onLayout={onLayout}>
      {size && (
        <Svg style={StyleSheet.absoluteFill} width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              {stops.map((color, i) => (
                <Stop key={i} offset={String(i / (stops.length - 1))} stopColor={color} />
              ))}
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.width} height={size.height} fill={`url(#${id})`} />
        </Svg>
      )}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', backgroundColor: colors.ink },
});
