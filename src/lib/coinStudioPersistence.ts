import type { SupabaseClient } from '@supabase/supabase-js';
import { asRecord, itemPhotos } from '@/lib/itemPhotos';
import { coinStudioSelection } from '@/lib/coinStudioContract';
export interface CoinStudioSave { client: SupabaseClient; tenantId: string; itemId: string; originals: string[]; faces: Record<string, unknown>[]; signal: AbortSignal; check: () => Promise<void>; }
/** Merge verified derivatives only. Never replace media, identification evidence or seller edits. */
export async function saveCoinStudioPair(options: CoinStudioSave): Promise<Record<string, unknown>> {
  const { client, tenantId, itemId, originals, faces, signal, check } = options;
  const read = () => client.from('items').select('*').eq('id', itemId).eq('tenant_id', tenantId).eq('specialist_id', 'coins').abortSignal(signal).single();
  await check();
  const fresh = await read();
  if (fresh.error || !fresh.data?.updated_at || originals.some(original => !itemPhotos(fresh.data).some(photo => photo.original === original))) throw new Error('Coin originals changed during processing. Originals retained.');
  const attrs = asRecord(fresh.data.attributes), entries = { ...asRecord(attrs._smart_studio_images) };
  for (const face of faces) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(face.originalUri)));
    const slot = `existing_${Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
    entries[slot] = face;
  }
  const savedSelection = Array.isArray(attrs.ebay_listing_media) ? attrs.ebay_listing_media.filter((v): v is string => typeof v === 'string') : null;
  // Only untouched original defaults are upgraded. Explicit seller selection (including empty) wins.
  const selection = savedSelection ?? coinStudioSelection(originals, faces);
  await check();
  const saved = await client.from('items').update({ attributes: { ...attrs, _smart_studio_images: entries, ebay_listing_media: selection } }).eq('id', itemId).eq('tenant_id', tenantId).eq('specialist_id', 'coins').eq('updated_at', fresh.data.updated_at).select('id').abortSignal(signal).maybeSingle();
  if (saved.error || !saved.data) throw new Error('Coin photo selection changed during preparation. No seller edits were overwritten.');
  await check();
  const verified = await read(), stored = Object.values(asRecord(asRecord(verified.data?.attributes)._smart_studio_images)).map(asRecord);
  if (verified.error || !verified.data || JSON.stringify(verified.data.media) !== JSON.stringify(fresh.data.media) || faces.some(face => !stored.some(row => row.originalUri === face.originalUri && row.enhancedUri === face.enhancedUri && row.pairKey === face.pairKey))) throw new Error('Stored coin presentations could not be verified. Inspect originals in the same listing.');
  return verified.data;
}
