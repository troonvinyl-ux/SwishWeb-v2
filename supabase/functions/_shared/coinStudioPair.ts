import { imageBytes, decodeStudioRaster, encodeStudioPng, studioHash } from './smartStudioEngine.ts';
import { removeBackgroundBytes } from './backgroundEraseService.ts';
import { assessCoinPair } from './coinStudioAI.ts';
import { coinMaskBounds } from './coinStudioMask.ts';
import { coinRenderPlan, coinPairGeometrySafe } from './coinStudioGeometry.ts';
import { renderCoinPhotograph } from './coinStudioRender.ts';
import { COIN_SNAP_VERSION } from './coinStudioTypes.ts';
export interface CoinProcessingFace { side: 'obverse' | 'reverse'; originalUri: string; imageDataUrl: string; }
export interface CoinProcessedFace { side: string; originalUri: string; image: Uint8Array; metadata: Record<string, unknown>; }
function pngData(bytes: Uint8Array): string {
  let binary = ''; for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return `data:image/png;base64,${btoa(binary)}`;
}
/** Extension of processStudioCopy: same provider, same codec, paired deterministic photography. */
export async function processCoinStudioPair(faces: CoinProcessingFace[], signal: AbortSignal): Promise<CoinProcessedFace[]> {
  if (faces.length !== 2 || faces[0].side !== 'obverse' || faces[1].side !== 'reverse') throw new Error('Obverse and reverse originals required.');
  const sources = faces.map(face => decodeStudioRaster(imageBytes(face.imageDataUrl))), masks = [], assessmentImages: string[] = [];
  // Sequential provider calls bound memory and credits; exactly one per original, no retries.
  for (const face of faces) {
    if (signal.aborted) throw new Error('Coin studio cancelled.');
    const png = await removeBackgroundBytes(imageBytes(face.imageDataUrl), /^data:image\/png;/i.test(face.imageDataUrl) ? 'image/png' : 'image/jpeg');
    masks.push(decodeStudioRaster(png)); assessmentImages.push(face.imageDataUrl, pngData(png));
  }
  const assessment = await assessCoinPair(assessmentImages, signal);
  if (!assessment.samePhysicalCoin || !assessment.oppositeFaces || !assessment.scaleComparable) throw new Error('The two faces could not be safely matched. Original photographs retained.');
  const plans = faces.map((_, i) => coinRenderPlan(coinMaskBounds(sources[i], masks[i], assessment.faces[i]), assessment.faces[i]));
  if (!coinPairGeometrySafe(plans)) throw new Error('Obverse/reverse geometry differs; no shape matching was invented.');
  const results: CoinProcessedFace[] = [];
  for (let i = 0; i < faces.length; i++) {
    if (signal.aborted) throw new Error('Coin studio cancelled.');
    const output = renderCoinPhotograph(sources[i], masks[i], plans[i]);
    if (!output.audit.backgroundWhite || !output.audit.colourShiftBounded) throw new Error('Photographic processing failed its deterministic audit.');
    const metadata = { version: 'backgrounderase-3.0.0', presentationVersion: COIN_SNAP_VERSION, status: 'ready', confidence: assessment.faces[i].confidence,
      originalUri: faces[i].originalUri, sourceHash: await studioHash(imageBytes(faces[i].imageDataUrl)), warnings: ['Original optical detail retained; 1600px export does not create missing detail.'],
      quality: { ...output.audit, fidelityPassed: true, fidelityBasis: 'source-only deterministic raster plus conservative AI mask assessment; not a physical authenticity certificate', completeness: 'assessed', boundary: 'provider alpha checked against source outline and holes', detailCheck: 'No provider RGB, reconstruction, healing, white balance or artificial texture', background: 'pure_white', scaleMatched: true, pairPassed: true },
      transform: { method: plans[i].perspectiveApplied ? 'minor_axis_correction' : 'similarity', ...plans[i], outputWidth: 1600, outputHeight: 1600 } };
    results.push({ side: faces[i].side, originalUri: faces[i].originalUri, image: encodeStudioPng(output.raster, metadata), metadata });
  }
  return results;
}
