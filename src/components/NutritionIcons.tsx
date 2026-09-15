import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';

interface IconProps {
  size?: number;
  color: string;
}

// All three food icons are drawn upright/symmetric first, then tilted by
// the same angle as a single group -- like food plated at an angle -- so
// the set reads as one consistent, deliberate style.
const TILT = 'rotate(18 12 12)';

// A chicken drumstick -- a classic clipart silhouette: two-tone brown
// meat with a jagged torn edge giving way to a pale bone -- reads as
// "protein". Already drawn at a natural diagonal, per reference.
export function ProteinIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G transform="rotate(35 12 12)">
        <Path
          d="M9.3 13.5 L10.9 20.8 C11.1 21.6 10.3 22.3 9.5 22.1 C8.8 21.9 8.4 21.2 8.6 20.6 L9.3 13.5 Z"
          fill="#DCDCDC"
        />
        <Ellipse
          cx="8.9"
          cy="21.2"
          rx="1.8"
          ry="1.4"
          fill="#DCDCDC"
          transform="rotate(-15 8.9 21.2)"
        />
        <Ellipse cx="12" cy="7.5" rx="5.6" ry="6.4" fill="#8B5A2B" />
        <Ellipse cx="9.9" cy="4.5" rx="2.1" ry="2.6" fill="#B8793D" />
        <Path
          d="M8.3 12.1 L9.9 11.1 L10.8 12.5 L12 11.2 L13.4 12.3 L11.9 14.1 L9 14 Z"
          fill="#DCDCDC"
        />
      </G>
    </Svg>
  );
}

// A wheat sprig -- golden grain leaves -- reads as "carbs". Drawn in fixed
// food colors rather than the macro's ring color, per reference.
export function CarbsIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G transform={TILT}>
        <Path d="M12 21L12 11.5" stroke="#B98A46" strokeWidth={1.5} strokeLinecap="round" />
        <Path d="M12 3C13.9 5.1 14.6 7.8 12 12.5C9.4 7.8 10.1 5.1 12 3Z" fill="#E7B75B" />
        <Path d="M6.5 6.3C8.8 7.3 10.3 9.4 8.9 13.4C6.1 11.4 5 9 6.5 6.3Z" fill="#D9A247" />
        <Path d="M17.5 6.3C15.2 7.3 13.7 9.4 15.1 13.4C17.9 11.4 19 9 17.5 6.3Z" fill="#D9A247" />
      </G>
    </Svg>
  );
}

// A single avocado half -- dark green skin, light green flesh, and a
// brown pit with a highlight -- reads as "fat". Drawn in fixed food
// colors rather than the macro's ring color, per reference.
export function FatIcon({ size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <G transform={TILT}>
        <Path
          d="M12 2.3C8.3 2.3 5.3 6.7 5.3 11.6C5.3 17.1 8.3 21.7 12 21.7C15.7 21.7 18.7 17.1 18.7 11.6C18.7 6.7 15.7 2.3 12 2.3Z"
          fill="#5B8C3E"
        />
        <Path
          d="M12 4.6C9.2 4.6 7 8.1 7 11.9C7 16.3 9.3 19.9 12 19.9C14.7 19.9 17 16.3 17 11.9C17 8.1 14.8 4.6 12 4.6Z"
          fill="#CFE29B"
        />
        <Circle cx="12" cy="13.8" r="4.2" fill="#8B5A34" />
        <Circle cx="10.6" cy="12.3" r="1.2" fill="#B8825A" opacity={0.8} />
      </G>
    </Svg>
  );
}
