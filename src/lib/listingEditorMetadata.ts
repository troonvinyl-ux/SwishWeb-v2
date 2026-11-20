import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord, itemPhotos } from '@/lib/itemPhotos';
import { listingSpecifics, type ConfirmedMusicDetails } from '@/lib/listingEditorData';
interface MetadataInput { client: SupabaseClient; item: Record<string, unknown>; form: Record<string, unknown>; photos: string[]; uploads: string[]; options: Record<string, unknown>; confirmedMusic?: ConfirmedMusicDetails; }
/** Compatibility for existing RPC versions that ignore newer p_item_patch keys. No schema changes. */
export async function retainListingEditorMetadata({ client, item, form, photos, uploads, options, confirmedMusic }: MetadataInput): Promise<Record<string, unknown>> {
  const attrs = asRecord(item.attributes), music = confirmedMusic || {}, evidence = { ...asRecord(attrs._music_evidence) };
  for (const [key, value] of Object.entries(music)) evidence[key] = { value: String(value), source: 'user', confidence: null, reviewed: true };
  const specifics = listingSpecifics(attrs.ebay_item_specifics);
  if (music.media_grade) specifics['Record Grading'] = music.media_grade;
  if (music.sleeve_grade) specifics['Sleeve Grading'] = music.sleeve_grade;
  const next = { ...attrs, ...music, ebay_category_id: String(form.category_id || ''), ebay_category_name: String(form.category || ''), ebay_condition_id: String(form.condition_id || ''), ebay_listing_media: photos, ebay_listing_options: options, ...(Object.keys(music).length ? { ebay_item_specifics: Object.entries(specifics).map(([name, value]) => ({ name, value })), _music_evidence: evidence, _music_quick_sale: null } : {}) };
  const notes = String(form.condition_description ?? ''), media = [...new Set([...itemPhotos(item).map(photo => photo.original), ...uploads])];
  const originals = new Set(itemPhotos(item).map(photo => photo.original));
  const needsWrite = JSON.stringify(next) !== JSON.stringify(attrs) || String(item.condition_notes || '') !== notes || uploads.some(url => !originals.has(url));
  if (!needsWrite) return item;
  if (!item.updated_at) throw new Error('Saved stock version is unavailable. Your edits remain on screen; reload before retrying.');
  const result = await client.from('items').update({ attributes: next, condition_notes: notes, ...(uploads.length ? { media } : {}) }).eq('id', item.id).eq('tenant_id', item.tenant_id).eq('updated_at', item.updated_at).select('*').maybeSingle();
  if (result.error || !result.data) throw new Error(result.error?.message || 'Stock changed while retaining category and condition. Your edits remain on screen; reload this same draft.');
  return result.data as Record<string, unknown>;
}
