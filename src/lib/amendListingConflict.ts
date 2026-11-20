import { asRecord } from '@/lib/itemPhotos';
import { MUSIC_GRADE_PATTERN } from '@/lib/listingConflicts';
import { musicSnapshotFromItem } from '@/lib/musicSavedItem';
import type { ConfirmedMusicDetails } from '@/lib/listingEditorData';
import type { ListingConflict, ListingConflictAnswer } from '@/types/listingConflict';
/** A seller answer updates only its labelled fact; never rewrites unrelated tracks or grade claims. */
export function amendListingConflict(form: Record<string, unknown>, item: Record<string, unknown>, conflict: ListingConflict, answer: ListingConflictAnswer): { form: Record<string, unknown>; confirmedMusic?: ConfirmedMusicDetails } {
  const value = answer.value.trim(), next = { ...form }, values = musicSnapshotFromItem(item).values;
  if (conflict.field === 'media_grade' || conflict.field === 'sleeve_grade') {
    if (!new RegExp(`^${MUSIC_GRADE_PATTERN}$`).test(value)) throw new Error('Choose the actual media or sleeve grade.');
    const media = conflict.field === 'media_grade', label = media ? '(?:media|record(?:\\s+grading)?|vinyl)' : '(?:sleeve|cover|packaging)';
    const pattern = new RegExp(`(\\b${label}\\s*(?:(?:grade|grading|condition)\\s*)?(?::|[-=]|(?:is\\s+)?(?:graded|listed)(?:\\s+as)?|is)?\\s*(?:<[^>]+>\\s*)*["'“‘]?)${MUSIC_GRADE_PATTERN}`, 'gi');
    for (const key of ['title', 'description', 'condition_description', 'condition']) next[key] = String(next[key] || '').replace(pattern, (_match, prefix: string) => `${prefix}${value}`);
    return { form: next, confirmedMusic: { [conflict.field]: value } };
  }
  if (conflict.field === 'play_tested') {
    if (!['yes', 'no'].includes(value) || value === 'yes' && answer.notes.trim().length < 5) throw new Error('Confirm playback and record your actual findings; do not invent equipment or audio quality.');
    values.play_tested = value === 'yes';
    const disclosure = values.play_tested ? 'Playback: Seller reports play-testing; see the playback notes below. This is not a guarantee of defect-free audio.' : 'Not play-tested. Photographs cannot establish sound quality or hidden playback defects.';
    let description = String(next.description || '').replace(/^(?:Playback: Seller reports play-testing;[^\r\n]*|Not play-tested\. Photographs cannot establish sound quality or hidden playback defects\.)$/gim, disclosure).replace(/Seller confirms this item has been play[- ]tested\.?/gi, disclosure);
    if (!/Not play-tested\.|Playback:/i.test(description)) description += `\n\n${disclosure}`;
    const notes = answer.notes.trim();
    description = description.replace(/^Playback notes:[^\r\n]*$/gim, '');
    if (notes) description += `\nPlayback notes: ${notes}`;
    next.description = description;
    next.condition_description = [String(form.condition_description || ''), values.play_tested ? `Play-tested: ${notes}` : 'Not play-tested.'].filter(Boolean).join('\n');
    return { form: next, confirmedMusic: { play_tested: values.play_tested, condition_notes: String(next.condition_description) } };
  }
  if (conflict.field === 'tracklisting') {
    const tracks = asRecord(item.attributes)._music_tracklisting;
    const text = value === 'saved' && Array.isArray(tracks) ? tracks.map(raw => { const track = asRecord(raw); return [track.position, track.title, track.duration ? `(${track.duration})` : ''].filter(Boolean).join(' '); }).join('\n') : value === 'manual' ? answer.notes.trim() : '';
    if (!text) throw new Error('Provide the complete tracklisting you checked against this item.');
    const original = String(next.description || '');
    // Replace only the generated Tracklisting section; preserve the seller photo disclaimer and other content.
    const section = /(?:^|\n)Tracklisting\s*\n[\s\S]*?(?=\n[ \t]*\n|\n\s*Please review the seller|$)/i;
    next.description = section.test(original) ? original.replace(section, `\nTracklisting\n${text}\n`) : `${original}\n\nTracklisting\n${text}`;
    return { form: next };
  }
  if (!value) throw new Error('Enter the corrected factual text.');
  next[conflict.field] = value;
  return { form: next };
}
