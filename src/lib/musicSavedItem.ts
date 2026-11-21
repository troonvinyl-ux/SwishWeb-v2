import { captureRecord } from '@/lib/captureRequest';
import { MUSIC_DEFAULTS } from '@/constants/music';
import { z } from 'zod';
import { ebayMusicGrade, musicGradeCode, musicGradeAspects } from '@/lib/ebayMusicContract';
import type { MusicPrice, MusicSnapshot, MusicValues, MusicField } from '@/types/music';
const priceSchema = z.object({ market: z.number().positive(), quick: z.number().positive(), minimum: z.number().positive(), confidence: z.string(), basis: z.enum(['sold_supported_estimate', 'asking_context_estimate', 'ai_only_estimate']), explanation: z.string(), warnings: z.array(z.string()), researchedAt: z.string() });
export function savedMusicPrice(item: Record<string, unknown> | null): MusicPrice | null { const result = priceSchema.safeParse(captureRecord(item?.attributes)._music_quick_sale); return result.success ? result.data as MusicPrice : null; }
export function musicSnapshotFromItem(item: Record<string, unknown>): MusicSnapshot {
  const attrs = captureRecord(item.attributes), values = { ...MUSIC_DEFAULTS };
  for (const key of Object.keys(values) as Array<keyof MusicValues>) { const value = attrs[key]; if (typeof values[key] === 'string' && (typeof value === 'string' || typeof value === 'number')) Object.assign(values, { [key]: String(value) }); }
  const raw = attrs.ebay_item_specifics, specifics = Array.isArray(raw) ? Object.fromEntries(raw.map(entry => { const row = captureRecord(entry); return [String(row.name || ''), String(row.value || '')]; })) : captureRecord(raw);
  const aliases: Record<string, string> = { artist: 'Artist', release_title: 'Release Title', format: 'Format', label: 'Record Label', year: 'Release Year', catalogue_number: 'Catalog Number', record_size: 'Record Size', speed: 'Speed', genre: 'Genre', style: 'Style', edition: 'Edition', features: 'Features' };
  for (const [key, name] of Object.entries(aliases)) if (!attrs[key] && specifics[name]) Object.assign(values, { [key]: String(specifics[name]) });
  if (!values.barcode) values.barcode = String(specifics.EAN || specifics.UPC || '');
  const grades = musicGradeAspects(values.format);
  for (const [key, name] of [['media_grade', grades.media], ['sleeve_grade', grades.sleeve]] as const) {
    const saved = musicGradeCode(values[key]), ebay = specifics[name];
    // Poor remains the seller's Goldmine grade when its eBay representation is Worn.
    values[key] = saved && (!ebay || ebayMusicGrade(saved) === ebayMusicGrade(ebay)) ? saved : musicGradeCode(ebay || saved);
  }
  values.condition_notes = String(item.condition_notes ?? item.condition_grade ?? values.condition_notes);
  values.play_tested = attrs.play_tested === true; values.reviewed = attrs._music_reviewed === true; values.pressing_reviewed = attrs.pressing_reviewed === true || attrs.discogs_pressing_confirmed === true;
  const fields: MusicSnapshot['fields'] = {};
  for (const [key, rawField] of Object.entries(captureRecord(attrs._music_evidence))) { const field = captureRecord(rawField); if (typeof field.value === 'string' && ['discogs', 'user', 'ai_inferred', 'image_extracted'].includes(String(field.source))) fields[key] = { value: field.value, source: field.source as MusicField['source'], confidence: typeof field.confidence === 'number' ? field.confidence : null, reviewed: field.reviewed === true }; }
  return { values, fields, photos: [], release: null, pricing: savedMusicPrice(item) };
}
