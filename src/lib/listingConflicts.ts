import { asRecord } from '@/lib/itemPhotos';
import { listingSpecifics } from '@/lib/listingEditorData';
import type { ListingConflict } from '@/types/listingConflict';
export const MUSIC_GRADE_PATTERN = '(NM|VG\\+|VG|G\\+|G|M|F|P)(?![\\w+])';
export function labelledMusicGrades(text: string, field: 'media_grade' | 'sleeve_grade'): string[] {
  const label = field === 'media_grade' ? '(?:media|record(?:\\s+grading)?|vinyl)' : '(?:sleeve|cover|packaging)';
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  const pattern = new RegExp(`\\b${label}\\s*(?:(?:grade|grading|condition)\\s*)?(?::|[-=]|(?:is\\s+)?(?:graded|listed)(?:\\s+as)?|is)?\\s*["'“‘]?${MUSIC_GRADE_PATTERN}`, 'gi');
  return [...plain.matchAll(pattern)].map(match => match[1].toUpperCase());
}
const unique = (values: string[]) => [...new Set(values.filter(Boolean))];
/** Deterministic questions from actual conflicts, not AI permission scores or invented facts. */
export function listingConflicts(form: Record<string, unknown>, item: Record<string, unknown> | null, messages: string[]): ListingConflict[] {
  const attrs = asRecord(item?.attributes), specifics = listingSpecifics(attrs.ebay_item_specifics), result: ListingConflict[] = [];
  if (item?.specialist_id === 'vinyl_records') {
    for (const field of ['media_grade', 'sleeve_grade'] as const) {
      const media = field === 'media_grade', label = media ? 'media' : 'sleeve';
      const relevant = messages.filter(message => new RegExp(media ? 'media|record grad' : 'sleeve|cover grad', 'i').test(message) && /inconsisten|conflict|mismatch|contradict/i.test(message));
      const current = String(attrs[field] || specifics[media ? 'Record Grading' : 'Sleeve Grading'] || '');
      const reported = relevant.flatMap(message => [...message.matchAll(new RegExp(`["'“‘]${MUSIC_GRADE_PATTERN}["'”’]`, 'gi'))].map(match => match[1].toUpperCase()));
      const values = unique([current, ...labelledMusicGrades(String(form.description || ''), field), ...labelledMusicGrades(String(form.condition_description || ''), field), ...reported]).filter(value => /^(NM|VG\+|VG|G\+|G|M|F|P)$/.test(value));
      if (values.length > 1 || relevant.length) result.push({ id: field, field, question: `Which ${label} grade is correct for the physical item?`, detail: relevant[0] || `Saved details and listing text disagree: ${values.join(' vs ')}.`, options: values.map(value => ({ value, label: value })), current });
    }
    const playback = messages.find(message => /play[ -]?test|playback/i.test(message) && /unverifi|conflict|missing|lack|inconsisten/i.test(message));
    if (playback) result.push({ id: 'play_tested', field: 'play_tested', question: 'Did you personally play-test this item?', detail: playback, options: [{ value: 'yes', label: 'Yes — add my actual playback findings' }, { value: 'no', label: 'No — disclose that it is not play-tested' }], current: attrs.play_tested === true ? 'yes' : 'no' });
    const tracks = messages.find(message => /trackl|track list/i.test(message) && /truncat|incomplete|missing|cut off/i.test(message));
    if (tracks) result.push({ id: 'tracklisting', field: 'tracklisting', question: 'Which tracklisting should the buyer see?', detail: tracks, options: Array.isArray(attrs._music_tracklisting) && attrs._music_tracklisting.length ? [{ value: 'saved', label: 'Use the complete saved catalogue tracklisting' }, { value: 'manual', label: 'Enter my corrected tracklisting' }] : [{ value: 'manual', label: 'Enter my corrected tracklisting' }], current: '' });
  }
  for (const field of ['title', 'description', 'condition_description'] as const) {
    const issue = messages.find(message => !/confidence|play[ -]?test|trackl|media|sleeve|network|timeout|auth|policy|prohibited|counterfeit/i.test(message) && new RegExp(field === 'condition_description' ? 'condition' : field, 'i').test(message) && /conflict|contradict|inconsisten|missing|too short|incomplete/i.test(message));
    if (issue) result.push({ id: field, field, question: `What is the correct ${field.replace(/_/g, ' ')}?`, detail: issue, options: [], current: String(form[field] || '') });
  }
  return result;
}
