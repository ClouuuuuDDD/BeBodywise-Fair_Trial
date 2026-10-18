/**
 * Character art manifest. Files live in app/public/art/ (made from assets/characters/*.png:
 * WebP q82, alpha kept, trimmed to the canvas crop, @1x and @2x, plus thumb/ for mascots).
 * w/h are the @1x pixel size, so h/w is the crop aspect used to avoid layout shift.
 * Generated once from engineering/handoff/assets.json; edit by regenerating, not by hand.
 */

export const MASCOTS = {
  "chemist-tube": { w: 88, h: 85, alt: "Chemist cream" },
  "cream-jar": { w: 88, h: 87, alt: "Pigmentation Repair Cream / kits" },
  "deodorant": { w: 88, h: 87, alt: "Deodorant" },
  "hair-removal": { w: 88, h: 84, alt: "hair removal cream" },
  "lotion": { w: 88, h: 84, alt: "body lotion" },
  "razor": { w: 48, h: 52, alt: "razor" },
  "retinol": { w: 88, h: 93, alt: "Retinol" },
  "rollon-celebrate": { w: 176, h: 181, alt: "Roll-on celebrating" },
  "rollon-goodbye": { w: 176, h: 211, alt: "Roll-on, retired, waving goodbye" },
  "rollon-sleepy": { w: 144, h: 148, alt: "Roll-on in a nightcap" },
  "rollon-strong": { w: 88, h: 89, alt: "6% roll-on" },
  "rollon-worried": { w: 96, h: 97, alt: "Roll-on looking worried" },
  "rollon": { w: 152, h: 149, alt: "4% roll-on" },
  "serum": { w: 88, h: 89, alt: "Serum" },
  "spray-can": { w: 96, h: 99, alt: "deodorant spray" },
  "sunscreen": { w: 88, h: 88, alt: "sunscreen" },
  "toner-worried": { w: 56, h: 66, alt: "toner sheepish" },
  "toner": { w: 80, h: 84, alt: "glycolic toner" },
} as const;

export type MascotId = keyof typeof MASCOTS;

export const DR_MEHR_POSES = {
  "wave": { file: "pose-01-wave", w: 216, h: 338, alt: "Dr. Mehr waving hello" },
  "curious": { file: "pose-02-curious", w: 152, h: 222, alt: "Dr. Mehr, curious" },
  "clipboard": { file: "pose-03-clipboard", w: 104, h: 152, alt: "Dr. Mehr with a clipboard" },
  "point": { file: "pose-04-point", w: 144, h: 231, alt: "Dr. Mehr pointing" },
  "camera": { file: "pose-05-camera", w: 112, h: 183, alt: "Dr. Mehr with a camera" },
  "calendar": { file: "pose-06-calendar", w: 184, h: 285, alt: "Dr. Mehr holding a calendar page" },
  "concerned": { file: "pose-07-concerned", w: 144, h: 258, alt: "Dr. Mehr calm, hand on chest" },
  "proud": { file: "pose-08-proud", w: 104, h: 159, alt: "Dr. Mehr, smiling" },
  "open-palms": { file: "pose-09-open-palms", w: 176, h: 248, alt: "Dr. Mehr with open palms" },
  "avatar": { file: "pose-10-avatar", w: 64, h: 63, alt: "Dr. Mehr" },
} as const;

export type DrMehrPose = keyof typeof DR_MEHR_POSES;

/** ingredient-rules.json product type -> mascot id (engineering/handoff/assets.json). */
export const PRODUCT_TYPE_TO_MASCOT: Record<string, MascotId> = {
  'deodorant-stick': 'deodorant',
  'deodorant-spray': 'spray-can',
  'toner-or-exfoliant': 'toner',
  'body-lotion': 'lotion',
  serum: 'serum',
  'hair-removal-cream': 'hair-removal',
  retinoid: 'retinol',
  sunscreen: 'sunscreen',
  'chemist-cream': 'chemist-tube',
  'bodywise-rollon-4': 'rollon',
  'bodywise-rollon-6': 'rollon-strong',
  'bodywise-cream': 'cream-jar',
};

/** Mascot for a product type; unknown types fall back to the chemist tube. */
export function mascotForProductType(type: string): MascotId {
  return PRODUCT_TYPE_TO_MASCOT[type] ?? 'chemist-tube';
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Public URL of a file in app/public/art/. */
export function artUrl(path: string): string {
  return `${BASE}/art/${path}`;
}
