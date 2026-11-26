import { studioHash } from './smartStudioEngine.ts';
// Structural SDK contract avoids creating another client or mixing npm/esm SDK class identities.
export interface CoinStudioStorage {
  download(path: string): Promise<{ data: Blob | null; error: { message: string } | null }>;
  upload(path: string, bytes: Uint8Array, options: { contentType: string; upsert: boolean; cacheControl: string }): Promise<{ error: { message: string } | null }>;
  getPublicUrl(path: string): { data: { publicUrl: string } };
}
export interface CoinStudioManifest { pairKey: string; itemId: string; faces: Record<string, unknown>[]; hashes: string[]; paths: string[]; }
export async function readCoinStudioManifest(storage: CoinStudioStorage, prefix: string, key: string): Promise<CoinStudioManifest | null> {
  const result = await storage.download(`${prefix}/pair.json`);
  if (result.error || !result.data || result.data.size > 32_000) return null;
  const manifest: CoinStudioManifest = JSON.parse(await result.data.text());
  if (manifest.pairKey !== key || !Array.isArray(manifest.faces) || manifest.faces.length !== 2 || manifest.hashes?.length !== 2 || manifest.paths?.length !== 2 || manifest.paths.some(path => !path.startsWith(`${prefix}/`))) return null;
  for (let i = 0; i < 2; i++) {
    const image = await storage.download(manifest.paths[i]);
    if (image.error || !image.data || await studioHash(new Uint8Array(await image.data.arrayBuffer())) !== manifest.hashes[i]) return null;
  }
  return manifest;
}
/** Publish the manifest only after BOTH immutable PNGs pass byte-for-byte storage readback. */
export async function writeCoinStudioBytes(storage: CoinStudioStorage, path: string, bytes: Uint8Array, mime: string): Promise<void> {
  if (bytes.length > 5_242_880) throw new Error('Coin presentation exceeds safe storage size.');
  const upload = await storage.upload(path, bytes, { contentType: mime, upsert: false, cacheControl: '31536000' });
  const readback = await storage.download(path);
  if (readback.error || !readback.data || await studioHash(new Uint8Array(await readback.data.arrayBuffer())) !== await studioHash(bytes)) throw new Error(upload.error?.message || 'Coin presentation storage could not be verified.');
}
