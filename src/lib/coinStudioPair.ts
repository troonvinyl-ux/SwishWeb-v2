import { getSupabaseClientAsync, callEdgeFunction } from '@/lib/supabase';
import { getActiveNicheId } from '@/lib/niche';
import { verifyModuleScope } from '@/lib/moduleScope';
import { asRecord, itemPhotos } from '@/lib/itemPhotos';
import { studioImageInput } from '@/lib/studioImageInput';
import { COIN_SNAP_VERSION, coinStudioSelection, verifiedCoinStudioPair, type CoinPhotoPreparation, type CoinStudioResponse } from '@/lib/coinStudioContract';
import { saveCoinStudioPair } from '@/lib/coinStudioPersistence';
interface CoinPairRequest { userId: string; tenantId: string; itemId: string; originals: string[]; signal: AbortSignal; }
/** The ONE shared Smart Studio endpoint owns segmentation, assessment, rendering and storage. */
export async function prepareCoinStudioPair({ userId, tenantId, itemId, originals, signal }: CoinPairRequest): Promise<CoinPhotoPreparation> {
  const client = await getSupabaseClientAsync();
  if (!client || originals.length !== 2 || new Set(originals).size !== 2) return { prepared: false, photos: originals, warnings: ['Both distinct original coin faces are needed for paired presentation.'] };
  const check = async () => {
    if (signal.aborted || getActiveNicheId() !== 'coins') throw new Error('Coin workspace changed. Original photos retained.');
    const session = await client.auth.getSession();
    if (session.error || session.data.session?.user.id !== userId) throw new Error('Sign-in changed during coin processing.');
    await verifyModuleScope(client, userId, tenantId, 'coins');
  };
  await check();
  const read = await client.from('items').select('*').eq('id', itemId).eq('tenant_id', tenantId).eq('specialist_id', 'coins').abortSignal(signal).single();
  if (read.error || !read.data || originals.some(original => !itemPhotos(read.data).some(photo => photo.original === original))) throw new Error('Original faces are not attached to this verified coin.');
  const stored = Object.values(asRecord(asRecord(read.data.attributes)._smart_studio_images)).map(asRecord);
  const existing = originals.map(original => stored.find(face => face.originalUri === original && face.presentationVersion === COIN_SNAP_VERSION));
  const cached = verifiedCoinStudioPair({ status: 'ready', presentationVersion: COIN_SNAP_VERSION, pairKey: existing[0]?.pairKey, faces: existing }, originals);
  if (cached) return { prepared: true, photos: coinStudioSelection(originals, cached), warnings: [], item: read.data };
  const faces = [];
  for (let i = 0; i < originals.length; i++) faces.push({ side: i === 0 ? 'obverse' : 'reverse', originalUri: originals[i], imageDataUrl: await studioImageInput(originals[i], signal, 1600) });
  await check();
  const payload = { route: 'coin_pair', tenantId, nicheId: 'coins', itemId, presentationVersion: COIN_SNAP_VERSION, faces };
  if (new TextEncoder().encode(JSON.stringify(payload)).length > 8_500_000) return { prepared: false, photos: originals, warnings: ['Professional processing copies exceed the safe request limit. Original photos selected.'] };
  const result = await callEdgeFunction<CoinStudioResponse>('swish-coin-image-enhance', payload, client, { signal });
  await check();
  const entries = verifiedCoinStudioPair(result.data, originals);
  if (result.error || !entries) {
    const outdated = result.error && /base64 image data URL is required/i.test(result.error.message || result.error.displayMessage);
    const warning = outdated
      ? 'The SWISH image worker still uses the single-photo route. Deploy the existing Coin Snap pair extension in the original SWISH Cloud project to enable centred white 1600px photos. Originals are retained; you can still list.'
      : 'The shared Coin Snap worker could not verify a professional pair. Originals are retained; use Prepare white-background photos to retry after service recovery. Listing remains available.';
    return { prepared: false, photos: originals, warnings: result.data?.warnings?.length ? result.data.warnings : [warning] };
  }
  // Bind the returned pixel audit to the exact photographic processing copies sent by this app.
  for (let i = 0; i < entries.length; i++) {
    const binary = atob(faces[i].imageDataUrl.split(',')[1]), bytes = new Uint8Array(binary.length);
    for (let p = 0; p < binary.length; p++) bytes[p] = binary.charCodeAt(p);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('');
    if (entries[i].sourceHash !== hash) return { prepared: false, photos: originals, warnings: ['The processing-source fingerprint does not match. Original photographs selected.'] };
  }
  const item = await saveCoinStudioPair({ client, tenantId, itemId, originals, faces: entries, signal, check });
  return { prepared: true, photos: coinStudioSelection(originals, entries), warnings: [], item };
}
