import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

interface IconProps {
  size?: number;
  color: string;
}

export function CloseIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line x1="5" y1="5" x2="19" y2="19" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
      <Line x1="19" y1="5" x2="5" y2="19" stroke={color} strokeWidth={2.2} strokeLinecap="round" />
    </Svg>
  );
}

// The classic "share" glyph -- an upward arrow out of an open tray.
export function ShareIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3V15M12 3L7.5 7.5M12 3L16.5 7.5"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M5 12V18.5C5 19.88 6.12 21 7.5 21H16.5C17.88 21 19 19.88 19 18.5V12"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HomeIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M12 3L3 10.5V21H9V14H15V21H21V10.5L12 3Z" fill={color} />
    </Svg>
  );
}

export function ChartIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="12" width="4" height="9" rx="1" fill={color} />
      <Rect x="10" y="7" width="4" height="14" rx="1" fill={color} />
      <Rect x="16" y="3" width="4" height="18" rx="1" fill={color} />
    </Svg>
  );
}

export function SettingsIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.85 9.2 C20.8 10.13 20.8 13.87 16.85 14.8 C18.02 18.69 14.78 20.56 12 17.6 C9.22 20.56 5.98 18.69 7.15 14.8 C3.2 13.87 3.2 10.13 7.15 9.2 C5.98 5.31 9.22 3.44 12 6.4 C14.78 3.44 18.02 5.31 16.85 9.2 Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  );
}

// A bowl with rising steam -- used for the Recipes tab.
export function BowlIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 12h18c0 4.4-3.3 8-9 8s-9-3.6-9-8Z"
        fill={color}
      />
      <Path
        d="M9 8c-1 -1.5 -1 -2.5 0 -4M14 8c-1 -1.5 -1 -2.5 0 -4"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

// Two overlapping people -- used for the Community tab.
export function CommunityIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="9" cy="8" r="3.4" fill={color} />
      <Path d="M2.5 20c0-4 3-6.6 6.5-6.6s6.5 2.6 6.5 6.6H2.5Z" fill={color} />
      <Circle cx="17" cy="9" r="2.6" fill={color} opacity={0.55} />
      <Path
        d="M14.8 13.6c2.7.4 4.7 2.7 4.7 6.4h-2.9"
        fill={color}
        opacity={0.55}
      />
    </Svg>
  );
}

/** `fill` optionally colours the inside of the lens (two-tone badges). */
export function SearchIcon({ size = 20, color, fill }: IconProps & { fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="10.5" cy="10.5" r="6.5" stroke={color} strokeWidth={2} fill={fill ?? 'none'} />
      <Path d="M19.5 19.5l-4.3-4.3" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

// A ribbon/flag bookmark mark. `filled` toggles solid vs. outline.
export function BookmarkIcon({
  size = 20,
  color,
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 2.5h12v19l-6-4.2-6 4.2v-19Z"
        fill={filled ? color : 'none'}
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// A sparkle/wand mark -- used for the camera's "Auto" scan mode.
export function SparkleIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2l1.8 5.6L19.4 9.4 13.8 11.2 12 17l-1.8-5.8L4.6 9.4l5.6-1.8L12 2Z"
        fill={color}
      />
      <Circle cx="19" cy="18" r="1.6" fill={color} />
      <Circle cx="5" cy="18.5" r="1.1" fill={color} />
    </Svg>
  );
}

// Barcode bars -- used for the camera's "Barcode" scan mode.
export function BarcodeIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2.5" y="4" width="1.6" height="16" rx="0.4" fill={color} />
      <Rect x="6" y="4" width="1" height="16" rx="0.3" fill={color} />
      <Rect x="8.5" y="4" width="2.2" height="16" rx="0.4" fill={color} />
      <Rect x="12.5" y="4" width="1" height="16" rx="0.3" fill={color} />
      <Rect x="15" y="4" width="1.6" height="16" rx="0.4" fill={color} />
      <Rect x="18.2" y="4" width="1" height="16" rx="0.3" fill={color} />
      <Rect x="20.4" y="4" width="1.6" height="16" rx="0.4" fill={color} />
    </Svg>
  );
}

// A price-tag mark -- used for the camera's "Label" (nutrition facts) scan mode.
export function TagIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 4h8l10 10-8 8L3 12V4Z"
        stroke={color}
        strokeWidth={1.8}
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="8" cy="9" r="1.6" fill={color} />
    </Svg>
  );
}

// A cup with a straw -- used for the camera's "Drink" scan mode.
export function CupIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="11" y="1.5" width="2" height="4" rx="1" fill={color} transform="rotate(12 12 3.5)" />
      <Path d="M6 8h12l-1.4 12.5a2 2 0 0 1-2 1.5H9.4a2 2 0 0 1-2-1.5L6 8Z" fill={color} />
      <Rect x="6" y="6.5" width="12" height="2" rx="1" fill={color} />
    </Svg>
  );
}

// A lightning bolt -- used for the camera's flash/torch toggle.
export function FlashIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" fill={color} />
    </Svg>
  );
}

// A picture frame with a mountain glyph -- used for the camera's "pick from
// gallery" button.
export function GalleryIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="2.5" y="4" width="19" height="16" rx="2.4" stroke={color} strokeWidth={1.8} fill="none" />
      <Circle cx="8.2" cy="9.2" r="1.9" fill={color} />
      <Path d="M4 18l5.5-6 4 4.2L17 12l3.3 6H4Z" fill={color} />
    </Svg>
  );
}

// Fork and knife -- a neutral "meal" mark used in the calorie ring and on
// each logged entry's calorie badge.
export function MealIcon({ size = 20, color }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="5.3" y="2" width="1.4" height="6" rx="0.7" fill={color} />
      <Rect x="7.4" y="2" width="1.4" height="6" rx="0.7" fill={color} />
      <Rect x="9.5" y="2" width="1.4" height="6" rx="0.7" fill={color} />
      <Path
        d="M5 8.2c0 1.9 1.3 3.1 3.1 3.1s3.1-1.2 3.1-3.1"
        stroke={color}
        strokeWidth={1.4}
        fill="none"
        strokeLinecap="round"
      />
      <Rect x="7.4" y="11" width="1.4" height="11" rx="0.7" fill={color} />
      <Path
        d="M17 2c-1.8 0-3 2-3 4.6c0 2.2 1 3.9 2.3 4.4V22h1.4V11c1.3-.5 2.3-2.2 2.3-4.4C20 4 18.8 2 17 2Z"
        fill={color}
      />
    </Svg>
  );
}

/** `fill` optionally colours the fork, leaving the knife in `color` (two-tone badges). */
export function PlanDayIcon({ size = 20, color, fill }: IconProps & { fill?: string }) {
  // Two-tone badges are drawn small, so the strokes get a little heavier there.
  const weight = fill ? 2.1 : 1.6;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M5 3v5a2 2 0 0 0 2 2v11M7 3v4M9 3v5a2 2 0 0 1-2 2"
        stroke={fill ?? color}
        strokeWidth={weight}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M17 21V3c-2 .8-3 3-3 5.8V13h3"
        stroke={color}
        strokeWidth={weight}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M20.5 2.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" fill={color} />
    </Svg>
  );
}

/** `fill` optionally colours the microphone head (two-tone badges). */
export function MicIcon({ size = 20, color, fill }: IconProps & { fill?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="3" width="6" height="11" rx="3" fill={fill ?? color} />
      <Path
        d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
