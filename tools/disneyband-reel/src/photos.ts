/**
 * Single-photo Ken Burns journey for the DisneyBand+ reel.
 *
 * Source: square meet-and-greet still of a boy (Star Wars Vader shirt) with a
 * white Stormtrooper DisneyBand+ on his right wrist (viewer's left).
 * Path: medium crop on the boy → progressive zoom/pan onto the band puck.
 */

export const PHOTO_SRC = 'photos/boy-disneyband.png';

/** Focus + scale keyframes along the continuous 45s journey (t in 0–1). */
export type JourneyKeyframe = {
  /** Normalized progress along the camera path (not wall-clock) */
  t: number;
  /** Cover-crop focus X (0–1 in source image) */
  fx: number;
  /** Cover-crop focus Y (0–1 in source image) */
  fy: number;
  /** Ken Burns zoom relative to cover-fit (1 = fill frame) */
  scale: number;
};

/**
 * Camera path:
 * - Start: 9:16 medium on boy's face/torso (thumbs up readable; band visible)
 * - End: Stormtrooper puck centered; scale capped so design stays readable
 *   source composite is ~1200×1230 (upscaled from 400×410 still); stop before mush
 */
export const JOURNEY: JourneyKeyframe[] = [
  // Opening hold — boy hero
  {t: 0.0, fx: 0.5, fy: 0.4, scale: 1.05},
  // Begin drifting toward wrist
  {t: 0.12, fx: 0.46, fy: 0.405, scale: 1.18},
  // Mid: face + band share frame
  {t: 0.45, fx: 0.38, fy: 0.41, scale: 1.5},
  // Band becoming hero
  {t: 0.78, fx: 0.3, fy: 0.418, scale: 1.85},
  // Final clear band (CTA hold)
  {t: 1.0, fx: 0.272, fy: 0.422, scale: 2.0},
];
