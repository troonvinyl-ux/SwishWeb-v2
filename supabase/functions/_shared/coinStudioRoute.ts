import type { CoinStudioStorage, CoinStudioManifest } from './coinStudioStorage.ts';
import { readCoinStudioManifest, writeCoinStudioBytes } from './coinStudioStorage.ts';
import { processCoinStudioPair, type CoinProcessingFace } from './coinStudioPair.ts';
import { imageBytes, studioHash } from './smartStudioEngine.ts';
import { COIN_SNAP_VERSION } from './coinStudioTypes.ts';
import { COIN_STUDIO_MODEL } from './coinStudioAI.ts';
interface CoinStockRead { data: { id: string; specialist_id: string; media: unknown } | null; error: unknown; }
interface CoinStockQuery { select(columns: string): CoinStockQuery; eq(column: string, value: unknown): CoinStockQuery; single(): PromiseLike<CoinStockRead>; }
interface CoinStudioContext { userId: string; userClient: { from(table: string): CoinStockQuery }; storage: CoinStudioStorage; }
const flights = new Map<string, Promise<CoinStudioManifest>>(), rates = new Map<string, number[]>();
/** Called only INSIDE the existing serveModule/authenticated swish-coin-image-enhance handler. */
export async function handleCoinStudioPair(body: Record<string, unknown>, context: CoinStudioContext, corsHeaders: Record<string, string>): Promise<Response> {
  const json = (data: Record<string, unknown>, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const fallback = (message: string) => json({ version: 'backgrounderase-3.0.0', presentationVersion: COIN_SNAP_VERSION, status: 'fallback', faces: [], warnings: [message], originalsRetained: true });
  if (body.nicheId !== 'coins' || typeof body.tenantId !== 'string' || typeof body.itemId !== 'string' || !Array.isArray(body.faces) || body.faces.length !== 2) return json({ error: 'Verified saved coin and two faces required.' }, 400);
  const faces = body.faces as CoinProcessingFace[];
  if (faces.some(face => !face || typeof face.imageDataUrl !== 'string' || face.imageDataUrl.length > 4_000_000 || typeof face.originalUri !== 'string' || !/^https:\/\/\S+$/.test(face.originalUri)) || faces[0].side !== 'obverse' || faces[1].side !== 'reverse' || faces[0].originalUri === faces[1].originalUri || new TextEncoder().encode(JSON.stringify(body)).length > 8_500_000) return json({ error: 'Distinct bounded obverse/reverse originals required.' }, 422);
  const stock = await context.userClient.from('items').select('id,specialist_id,media').eq('id', body.itemId).eq('tenant_id', body.tenantId).single();
  const media = stock.data?.media;
  if (stock.error || !stock.data || stock.data.specialist_id !== 'coins' || !Array.isArray(media) || faces.some(face => !media.includes(face.originalUri))) return json({ error: 'Original photographs are not attached to this verified coin.' }, 403);
  try {
    const hashes = await Promise.all(faces.map(face => studioHash(imageBytes(face.imageDataUrl))));
    if (hashes[0] === hashes[1]) return fallback('The same face was supplied twice. Both original photographs remain available.');
    const pairKey = await studioHash(new TextEncoder().encode(JSON.stringify({ version: COIN_SNAP_VERSION, model: COIN_STUDIO_MODEL, tenantId: body.tenantId, userId: context.userId, itemId: body.itemId, originals: faces.map(f => f.originalUri), hashes })));
    const prefix = `${body.tenantId}/studio/${context.userId}/coins/${pairKey}`;
    const cached = await readCoinStudioManifest(context.storage, prefix, pairKey);
    if (cached) return json({ status: 'ready', presentationVersion: COIN_SNAP_VERSION, pairKey, faces: cached.faces, cached: true });
    if (flights.has(pairKey)) { const result = await flights.get(pairKey)!; return json({ status: 'ready', presentationVersion: COIN_SNAP_VERSION, pairKey, faces: result.faces }); }
    const now = Date.now(), recent = (rates.get(context.userId) || []).filter(time => time > now - 60_000);
    if (recent.length >= 6 || flights.size >= 2) return fallback('Coin Studio is busy. Original photographs selected; no automatic provider retry.');
    rates.set(context.userId, [...recent, now]); if (rates.size > 256) rates.delete(rates.keys().next().value!);
    const work = (async (): Promise<CoinStudioManifest> => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 120_000);
      const output = await processCoinStudioPair(faces, controller.signal).finally(() => clearTimeout(timer));
      const paths = output.map(face => `${prefix}/${face.side}.png`), savedHashes: string[] = [], results: Record<string, unknown>[] = [];
      for (let i = 0; i < output.length; i++) {
        await writeCoinStudioBytes(context.storage, paths[i], output[i].image, 'image/png');
        savedHashes.push(await studioHash(output[i].image));
        results.push({ ...output[i].metadata, side: output[i].side, pairKey, cacheKey: pairKey, enhancedUri: context.storage.getPublicUrl(paths[i]).data.publicUrl });
      }
      const manifest = { pairKey, itemId: String(body.itemId), faces: results, hashes: savedHashes, paths };
      await writeCoinStudioBytes(context.storage, `${prefix}/pair.json`, new TextEncoder().encode(JSON.stringify(manifest)), 'application/json');
      return manifest;
    })();
    flights.set(pairKey, work);
    const result = await work.finally(() => flights.delete(pairKey));
    return json({ status: 'ready', presentationVersion: COIN_SNAP_VERSION, pairKey, faces: result.faces });
  } catch (cause) {
    console.error('[SWISH Coin Studio] Pair processing unavailable; originals retained.', cause instanceof Error ? cause.name : 'processing');
    return fallback('A safe professional pair could not be verified. Continue with the original photographs; no coin details were reconstructed.');
  }
}
