import React from 'react';
import {Composition} from 'remotion';
import {DisneyBandReel, FPS, HEIGHT, TOTAL_FRAMES, WIDTH} from './DisneyBandReel';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="DisneyBandReel"
        component={DisneyBandReel}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};
