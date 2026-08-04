import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import type {PhotoSlot} from './photos';

type Props = {
  photo: PhotoSlot;
  durationInFrames: number;
};

/**
 * Cover-fit photo with subtle Ken Burns: always zoom in, alternate pan.
 */
export const KenBurnsPhoto: React.FC<Props> = ({photo, durationInFrames}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.max(durationInFrames - 1, 1)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });

  const scale = interpolate(progress, [0, 1], [1, photo.zoomTo]);
  // Subtle horizontal drift (~3% of frame) so the subject stays in crop safety
  const panAmount = 3;
  const translateX =
    photo.pan === 'ltr'
      ? interpolate(progress, [0, 1], [-panAmount, panAmount])
      : interpolate(progress, [0, 1], [panAmount, -panAmount]);

  return (
    <AbsoluteFill style={{backgroundColor: '#0a1628', overflow: 'hidden'}}>
      <Img
        src={staticFile(photo.src)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: `${photo.focusX * 100}% ${photo.focusY * 100}%`,
          transform: `translateX(${translateX}%) scale(${scale})`,
          transformOrigin: `${photo.focusX * 100}% ${photo.focusY * 100}%`,
        }}
      />
      {/* Soft bottom vignette so white text stays readable */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.2) 28%, transparent 48%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
