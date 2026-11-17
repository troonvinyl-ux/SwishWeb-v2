import { getSupabaseClientAsync, callEdgeFunction } from '@/lib/supabase';
import { verifyModuleScope } from '@/lib/moduleScope';
import { getActiveNicheId, getSpecialistIdsForNiche } from '@/lib/niche';
import { asRecord, itemPhotos, usableStudio } from '@/lib/itemPhotos';
import { studioImageInput } from '@/lib/studioImageInput';
interface StudioRequest { userId: string; tenantId: string; itemId: string; original: string; signal: AbortSignal; }
/** Same BackgroundErase route, metadata/CAS contract and original preservation as native. */
export async function prepareItemStudioPhoto({ userId, tenantId, itemId, original, signal }: StudioRequest): Promise<Record<string, unknown>> {
  const client = await getSupabaseClientAsync(), nicheId = getActiveNicheId();
  if (!client || !userId || !tenantId || !itemId) throw new Error('Reopen your verified SWISH item before preparing photos.');
  const check = async () => {
    if (signal.aborted || getActiveNicheId() !== nicheId) throw new Error('Workspace changed or photo preparation cancelled. Original retained.');
    const session = await client.auth.getSession();
    if (session.error || session.data.session?.user.id !== userId) throw new Error('Your sign-in changed. Reopen this item.');
    await verifyModuleScope(client, userId, tenantId, nicheId);
  };
  await check();
  const specialists = getSpecialistIdsForNiche(nicheId);
  const read = () => client.from('items').select('*').eq('id', itemId).eq('tenant_id', tenantId).in('specialist_id', specialists).abortSignal(signal).single();
  const initial = await read();
  if (initial.error || !initial.data) throw new Error(initial.error?.message || 'Item unavailable in this workspace.');
  const photo = itemPhotos(initial.data).find(value => value.original === original);
  if (!photo) throw new Error('Choose an original photograph attached to this item.');
  if (photo.prepared) return initial.data;
  console.log('[SWISH Studio] Preparing original photo', { itemId, nicheId });
  const imageDataUrl = await studioImageInput(original, signal);
  await check();
  const result = await callEdgeFunction<Record<string, unknown>>('swish-coin-image-enhance', { imageDataUrl, tenantId, nicheId, itemId }, client, { signal });
  if (result.error) throw new Error(result.error.displayMessage);
  if (!usableStudio(result.data)) throw new Error('Background removal did not return a verified cutout. Continue with the original photo.');
  await check();
  // Merge fresh attributes, not a potentially stale screen snapshot. Do not write items.media.
  const fresh = await read();
  if (fresh.error || !fresh.data?.updated_at || !itemPhotos(fresh.data).some(value => value.original === original)) throw new Error('Inventory photos changed. Reload before preparing them again.');
  const attrs = asRecord(fresh.data.attributes), entries = asRecord(attrs._smart_studio_images), output = result.data!;
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(original));
  const slot = `existing_${Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')}`;
  const studio = { version: output.version, status: output.status, originalUri: original, enhancedUri: output.enhancedUri, maskUri: output.maskUri,
    sourceHash: output.sourceHash, cacheKey: output.cacheKey, confidence: output.confidence, warnings: output.warnings, quality: output.quality,
    ...(output.detection ? { detection: output.detection } : {}), ...(output.transform ? { transform: output.transform } : {}) };
  await check();
  const saved = await client.from('items').update({ attributes: { ...attrs, _smart_studio_images: { ...entries, [slot]: studio } } })
    .eq('id', itemId).eq('tenant_id', tenantId).in('specialist_id', specialists).eq('updated_at', fresh.data.updated_at).select('id').abortSignal(signal).maybeSingle();
  if (saved.error || !saved.data) throw new Error(saved.error?.message || 'Inventory changed while saving. Reload; the original was not overwritten.');
  await check();
  const verified = await read();
  const association = asRecord(asRecord(asRecord(verified.data?.attributes)._smart_studio_images)[slot]);
  if (verified.error || !verified.data || !usableStudio(association) || association.originalUri !== original || association.enhancedUri !== studio.enhancedUri || JSON.stringify(verified.data.media) !== JSON.stringify(fresh.data.media)) throw new Error('Saved photo association could not be confirmed. Reload to inspect it before retrying.');
  return verified.data;
}
export async function prepareSavedCoinPhotos(userId: string, tenantId: string, itemId: string, originals: string[]): Promise<void> {
  if (getActiveNicheId() !== 'coins') return;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 90_000);
  const run = async () => { for (const original of originals) await prepareItemStudioPhoto({ userId, tenantId, itemId, original, signal: controller.signal }); };
  return run().finally(() => clearTimeout(timer));
}
