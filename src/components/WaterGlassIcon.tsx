import React from 'react';
import Svg, { ClipPath, Defs, Ellipse, Path, Rect } from 'react-native-svg';

interface Props {
  size?: number;
  percent: number; // 0 to 1
}

const VIEW_W = 44;
const VIEW_H = 52;
const GLASS_PATH = 'M6 4 L38 4 L34 46 Q34 50 30 50 L14 50 Q10 50 10 46 Z';
const RIM_Y = 4;
const BOTTOM_Y = 50;

export function WaterGlassIcon({ size = 28, percent }: Props) {
  const height = (size * VIEW_H) / VIEW_W;
  const clamped = Math.min(1, Math.max(0, percent));
  const liquidTop = BOTTOM_Y - clamped * (BOTTOM_Y - RIM_Y);

  return (
    <Svg width={size} height={height} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}>
      <Defs>
        <ClipPath id="waterGlassClip">
          <Path d={GLASS_PATH} />
        </ClipPath>
      </Defs>
      <Path d={GLASS_PATH} fill="#F0F1F4" stroke="#111827" strokeWidth={1.5} strokeOpacity={0.12} />
      {clamped > 0 && (
        <>
          <Rect
            x={4}
            y={liquidTop}
            width={36}
            height={BOTTOM_Y - liquidTop + 4}
            fill="#38BDF8"
            clipPath="url(#waterGlassClip)"
          />
          <Ellipse
            cx={22}
            cy={liquidTop}
            rx={18}
            ry={3.5}
            fill="#7DD3FC"
            clipPath="url(#waterGlassClip)"
          />
        </>
      )}
      <Path d={GLASS_PATH} fill="none" stroke="#111827" strokeWidth={1.2} strokeOpacity={0.22} />
    </Svg>
  );
}
