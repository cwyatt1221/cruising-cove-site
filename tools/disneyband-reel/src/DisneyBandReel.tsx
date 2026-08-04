import React from 'react';
import {AbsoluteFill, Sequence} from 'remotion';
import {KenBurnsPhoto} from './KenBurnsPhoto';
import {PHOTOS} from './photos';
import {TextOverlay} from './TextOverlay';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;
export const TOTAL_FRAMES = 45 * FPS; // 1350

/** Convert seconds → frames */
const s = (seconds: number) => Math.round(seconds * FPS);

type PhotoBeat = {
  from: number;
  duration: number;
  photo: number;
};

type TextBeat = {
  from: number;
  duration: number;
  lines: string[];
  position?: 'bottom' | 'center';
};

/**
 * Exact timing from disneyband-reel-spec.md.
 * Photo beats drive Ken Burns; text beats can split within a long photo.
 */
const PHOTO_BEATS: PhotoBeat[] = [
  {from: s(0), duration: s(4), photo: 1},
  {from: s(4), duration: s(4), photo: 2},
  {from: s(8), duration: s(4), photo: 3},
  {from: s(12), duration: s(4), photo: 4},
  {from: s(16), duration: s(4), photo: 5},
  {from: s(20), duration: s(5), photo: 6},
  {from: s(25), duration: s(5), photo: 7},
  {from: s(30), duration: s(8), photo: 8},
  {from: s(38), duration: s(7), photo: 9},
];

const TEXT_BEATS: TextBeat[] = [
  {
    from: s(0),
    duration: s(4),
    lines: [
      'This tiny band was my room key,',
      'wallet, AND ticket on our',
      'Disney cruise 🌊✨',
    ],
  },
  {from: s(4), duration: s(4), lines: ['Room key. Payments.']},
  {
    from: s(8),
    duration: s(4),
    lines: ['Magic moments.', 'All on my wrist.'],
  },
  {from: s(12), duration: s(4), lines: ["It's DisneyBand+"]},
  {
    from: s(16),
    duration: s(4),
    lines: [
      'Link it before you sail —',
      'it does everything your',
      'room key card does.',
    ],
  },
  {from: s(20), duration: s(5), lines: ['Comes in solid colors']},
  {from: s(25), duration: s(5), lines: ['or themed designs 🎨']},
  {from: s(30), duration: s(4), lines: ['No digging through my bag.']},
  {
    from: s(34),
    duration: s(4),
    lines: ['No losing a paper key card.', 'Just relaxing.'],
  },
  {
    from: s(38),
    duration: s(7),
    lines: ['Save this for your next', 'Disney cruise! 🚢'],
    position: 'center',
  },
];

export const DisneyBandReel: React.FC = () => {
  return (
    <AbsoluteFill style={{backgroundColor: '#0a1628'}}>
      {PHOTO_BEATS.map((beat, i) => (
        <Sequence
          key={`photo-${i}`}
          from={beat.from}
          durationInFrames={beat.duration}
          name={`Photo ${beat.photo}`}
        >
          <KenBurnsPhoto
            photo={PHOTOS[beat.photo]}
            durationInFrames={beat.duration}
          />
        </Sequence>
      ))}

      {TEXT_BEATS.map((beat, i) => (
        <Sequence
          key={`text-${i}`}
          from={beat.from}
          durationInFrames={beat.duration}
          name={`Text ${i + 1}`}
        >
          <TextOverlay
            lines={beat.lines}
            durationInFrames={beat.duration}
            position={beat.position}
          />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};
