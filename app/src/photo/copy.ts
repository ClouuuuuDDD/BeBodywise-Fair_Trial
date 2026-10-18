/** One-line fix strings for the quality gate. Source: engineering/handoff/copy.md (s08.*). Owner: E3. */
import type { PhotoFailure } from '../contracts';

export const FIX_LINE: Record<PhotoFailure, string> = {
  dark: 'Too dark. Move closer to a window.',
  blur: 'A little blurry. Hold still and try again.',
  'card-missing': "I can't see the white paper. Keep it in the corner.",
  warm: 'The light is too yellow. Try daylight, no bulb.',
};

/** Fix lines for a failure list, in gate order. */
export function fixLines(failures: readonly PhotoFailure[]): string[] {
  return failures.map((f) => FIX_LINE[f]);
}

export const CAMERA_COPY = {
  instrUnderarm: 'Lift your arm. Fit your underarm in the oval.',
  instrInner: 'Turn your arm. Fit your inner arm in the oval.',
  card: 'CARD',
  cardTip: 'Hold a plain white paper in the corner. Face a window, no flash.',
  tapToStart: 'Tap to start the camera',
  inApp: 'Camera not working? Open this page in Chrome.',
  privacy: 'Photos never leave this phone',
  primary: 'Take photo',
  retake: 'Retake',
  noCamera: 'Camera not available. Pick a photo instead.',
  upload: 'Choose a photo',
  uploadShort: 'Upload',
  uploadLabel: 'Upload a photo instead',
} as const;
