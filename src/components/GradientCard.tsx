import React, { useState } from 'react';
import { LayoutChangeEvent, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';

// Near-black in the top-left easing to a lighter slate in the bottom-right,
// shared by the dark cards (Community score, Plan my whole day, Voice to Meal).
export const SHADED_GRADIENT = ['#0B0F17', '#1A2230', '#3E4A5F'] as const;

let gradientCounter = 0;

/**
 * A View with a diagonal gradient behind its children. The gradient is drawn
 * at the measured size because percentage sizes don't fill on iOS.
 */
export function GradientCard({
  style,
  children,
  stops = SHADED_GRADIENT,
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
