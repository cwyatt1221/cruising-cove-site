import React from 'react';
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {JOURNEY, PHOTO_SRC, type JourneyKeyframe} from './photos';

function sampleJourney(progress: number): {fx: number; fy: number; scale: number} {
  const keys = JOURNEY;
  if (progress <= keys[0].t) {
    return {fx: keys[0].fx, fy: keys[0].fy, scale: keys[0].scale};
  }
  const last = keys[keys.length - 1];
  if (progress >= last.t) {
    return {fx: last.fx, fy: last.fy, scale: last.scale};
  }
  let a: JourneyKeyframe = keys[0];
  let b: JourneyKeyframe = keys[1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (progress >= keys[i].t && progress <= keys[i + 1].t) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  const local = (progress - a.t) / Math.max(b.t - a.t, 1e-9);
  const eased = Easing.inOut(Easing.quad)(local);
  return {
    fx: a.fx + (b.fx - a.fx) * eased,
    fy: a.fy + (b.fy - a.fy) * eased,
    scale: a.scale + (b.scale - a.scale) * eased,
  };
}

/**
 * Map wall-clock frame → path progress.
 * 0–4s: settle on boy; 4–40s: main zoom to band; 40–45s: hold for CTA.
 */
function pathProgress(frame: number, fps: number): number {
  const t = frame / fps;
  if (t <= 4) {
    return interpolate(t, [0, 4], [0, 0.08], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.quad),
    });
  }
  if (t <= 40) {
    return interpolate(t, [4, 40], [0.08, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.inOut(Easing.cubic),
    });
  }
  return 1;
}

/**
 * Continuous Ken Burns on the single boy + DisneyBand+ photo.
 */
export const KenBurnsPhoto: React.FC = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const {fx, fy, scale} = sampleJourney(pathProgress(frame, fps));

  return (
    <AbsoluteFill style={{backgroundColor: '#0a1628', overflow: 'hidden'}}>
      <Img
        src={staticFile(PHOTO_SRC)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: `${fx * 100}% ${fy * 100}%`,
          transform: `scale(${scale})`,
          transformOrigin: `${fx * 100}% ${fy * 100}%`,
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
