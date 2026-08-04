import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Montserrat';

const {fontFamily} = loadFont('normal', {
  weights: ['600'],
  subsets: ['latin'],
});

type Props = {
  lines: string[];
  /** Frames this overlay is mounted for */
  durationInFrames: number;
  /** bottom | center */
  position?: 'bottom' | 'center';
};

const FADE_IN = 6; // 0.2s @ 30fps
const FADE_OUT = 5; // ~0.15s @ 30fps
const SLIDE_PX = 12;

export const TextOverlay: React.FC<Props> = ({
  lines,
  durationInFrames,
  position = 'bottom',
}) => {
  const frame = useCurrentFrame();

  const opacity = interpolate(
    frame,
    [0, FADE_IN, Math.max(durationInFrames - FADE_OUT, FADE_IN + 1), durationInFrames],
    [0, 1, 1, 0],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.quad),
    },
  );

  const translateY = interpolate(frame, [0, FADE_IN], [SLIDE_PX, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.quad),
  });

  const bottomStyle =
    position === 'center'
      ? {top: '42%', bottom: 'auto' as const}
      : {bottom: 150};

  return (
    <AbsoluteFill
      style={{
        justifyContent: position === 'center' ? 'center' : 'flex-end',
        alignItems: 'center',
        paddingLeft: 48,
        paddingRight: 48,
        ...bottomStyle,
        opacity,
        transform: `translateY(${translateY}px)`,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          maxWidth: 980,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          borderRadius: 18,
          padding: '18px 28px',
          textAlign: 'center',
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            style={{
              fontFamily,
              fontWeight: 600,
              fontSize: 68,
              lineHeight: 1.2,
              color: '#ffffff',
              textShadow: '0 2px 8px rgba(0,0,0,0.65)',
              letterSpacing: '-0.02em',
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
