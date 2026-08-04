/**
 * Photo slot mapping for the DisneyBand+ reel.
 *
 * No dedicated product close-ups were found on disk. These are the best
 * available cruise stills where a DisneyBand+ / wristband is visible, plus
 * a closing ship wide. Swap files in public/photos/ to iterate.
 */
export type PanDirection = 'ltr' | 'rtl';

export type PhotoSlot = {
  /** Filename under public/photos/ */
  src: string;
  /** Human-readable note for README / mapping */
  label: string;
  /** Alternate Ken Burns pan direction */
  pan: PanDirection;
  /** End zoom scale (start is always 1) */
  zoomTo: number;
  /**
   * Focal point for cover-crop (0–1). Prefer the wrist/band when known.
   * Used as object-position.
   */
  focusX: number;
  focusY: number;
};

export const PHOTOS: Record<number, PhotoSlot> = {
  1: {
    src: 'photos/01-hook.jpeg',
    label:
      'Hook — boy with blue DisneyBand+ by ship model (Welcome aboard_10)',
    pan: 'ltr',
    zoomTo: 1.12,
    focusX: 0.42,
    focusY: 0.55,
  },
  2: {
    src: 'photos/02-room-key.jpeg',
    label:
      'Room key vibe — couple at Treasure backdrop, red + dark bands visible',
    pan: 'rtl',
    zoomTo: 1.1,
    focusX: 0.35,
    focusY: 0.45,
  },
  3: {
    src: 'photos/03-payments.jpeg',
    label:
      'Wrist / lifestyle — couple Welcome aboard_2, both bands on wrists',
    pan: 'ltr',
    zoomTo: 1.1,
    focusX: 0.55,
    focusY: 0.48,
  },
  4: {
    src: 'photos/04-detail.jpeg',
    label:
      'Detail — family thumbs-up; white patterned band on boy’s wrist',
    pan: 'rtl',
    zoomTo: 1.11,
    focusX: 0.48,
    focusY: 0.55,
  },
  5: {
    src: 'photos/05-glow.jpeg',
    label:
      'Family + ship model — light blue band on wrist (Welcome aboard_15)',
    pan: 'ltr',
    zoomTo: 1.1,
    focusX: 0.62,
    focusY: 0.5,
  },
  6: {
    src: 'photos/06-variety.jpeg',
    label:
      'Variety / magic moment — Chewbacca_3 (portrait); band on boy’s wrist',
    pan: 'rtl',
    zoomTo: 1.1,
    focusX: 0.48,
    focusY: 0.55,
  },
  7: {
    src: 'photos/07-multiple.jpeg',
    label:
      'Multiple bands — family with Chewbacca & Rey; white + dark bands',
    pan: 'ltr',
    zoomTo: 1.09,
    focusX: 0.5,
    focusY: 0.55,
  },
  8: {
    src: 'photos/08-relaxed.jpeg',
    label: 'Relaxed magic moment — Moana hug; blue band on boy’s wrist',
    pan: 'rtl',
    zoomTo: 1.11,
    focusX: 0.35,
    focusY: 0.55,
  },
  9: {
    src: 'photos/09-closing.jpg',
    label: 'Closing wide — Disney Wish at Castaway Cay pier',
    pan: 'ltr',
    zoomTo: 1.08,
    focusX: 0.62,
    focusY: 0.4,
  },
};
