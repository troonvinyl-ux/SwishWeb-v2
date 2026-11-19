import type { MusicFields } from '@/types/music';

export type MusicCaptureMode = 'item' | 'cd_box_set';

/** Shared SWISH specialist modes, not display labels or music formats. */
export function musicCaptureMode(fields: MusicFields): MusicCaptureMode {
  const format = fields.format?.value ?? '';
  return /\b(?:CD|DVD|Blu-ray|box\s*set)\b/i.test(format) ? 'cd_box_set' : 'item';
}
