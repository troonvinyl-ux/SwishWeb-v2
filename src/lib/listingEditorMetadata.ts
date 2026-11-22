import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord, itemPhotos } from '@/lib/itemPhotos';
import { listingSpecifics, type ConfirmedMusicDetails } from '@/lib/listingEditorData';
import { MUSIC_EDIT_FIELDS } from '@/constants/music';
import { ebayMusicGrade, musicGradeAspects } from '@/lib/ebayMusicContract';
import { jsonEqual } from '@/lib/jsonEquality';
interface MetadataInput { client: SupabaseClient; item: Record<string, unknown>; form: Record<string, unknown>; photos: string[]; uploads: string[]; options: Record<string, unknown>; confirmedMusic?: ConfirmedMusicDetails; categoryChanged?: boolean; }
/** Compatibility for existing RPC versions that ignore newer p_item_patch keys. No schema changes. */
export async function retainListingEditorMetadata({ client, item, form, photos, uploads, options, confirmedMusic, categoryChanged = false }: MetadataInput): Promise<Record<string, unknown>> {
  const attrs = asRecord(item.attributes), values = asRecord(form.music_values), music: Record<string, unknown> = { ...confirmedMusic }, evidence = { ...asRecord(attrs._music_evidence) };
  if (item.specialist_id === 'vinyl_records' && Object.keys(values).length) {
    for (const [key] of MUSIC_EDIT_FIELDS) if (key !== 'location' && values[key] !== undefined) music[key] = key === 'condition_notes' ? String(form.condition_description || '') : values[key];
    for (const key of ['media_grade', 'sleeve_grade', 'play_tested']) if (values[key] !== undefined) music[key] = values[key];
  }
  for (const [key, value] of Object.entries(music)) if (attrs[key] !== value) evidence[key] = { value: String(value), source: 'user', confidence: null, reviewed: true };
  const specifics = listingSpecifics(attrs.ebay_item_specifics);
  const grades = musicGradeAspects(music.format || attrs.format);
  // The atomic editor RPC has already saved exact localized eBay values.
  if (confirmedMusic?.media_grade) specifics[grades.media] = ebayMusicGrade(confirmedMusic.media_grade);
  if (confirmedMusic?.sleeve_grade) specifics[grades.sleeve] = ebayMusicGrade(confirmedMusic.sleeve_grade);
  const next = { ...attrs, ...music, ebay_category_id: String(form.category_id || attrs.ebay_category_id || ''), ebay_category_name: String(form.category || (categoryChanged ? '' : attrs.ebay_category_name) || ''), ebay_condition_id: String(form.condition_id || (categoryChanged ? '' : attrs.ebay_condition_id) || ''), ebay_listing_media: photos, ebay_listing_options: options, ...(Object.keys(music).length ? { ...(confirmedMusic ? { ebay_item_specifics: Object.entries(specifics).map(([name, value]) => ({ name, value })) } : {}), _music_evidence: evidence, ...(Object.entries(music).some(([key, value]) => attrs[key] !== value) ? { _music_quick_sale: null } : {}) } : {}) };
  const notes = String(form.condition_description ?? ''), media = [...new Set([...itemPhotos(item).map(photo => photo.original), ...uploads])];
  const originals = new Set(itemPhotos(item).map(photo => photo.original));
  const needsWrite = !jsonEqual(next, attrs) || String(item.condition_notes || '') !== notes || uploads.some(url => !originals.has(url));
  if (!needsWrite) return item;
  if (!item.updated_at) throw new Error('Saved stock version is unavailable. Your edits remain on screen; reload before retrying.');
  const result = await client.from('items').update({ attributes: next, condition_notes: notes, ...(uploads.length ? { media } : {}) }).eq('id', item.id).eq('tenant_id', item.tenant_id).eq('updated_at', item.updated_at).select('*').maybeSingle();
  if (result.error || !result.data) throw new Error(result.error?.message || 'Stock changed while retaining category and condition. Your edits remain on screen; reload this same draft.');
  return result.data as Record<string, unknown>;
}
