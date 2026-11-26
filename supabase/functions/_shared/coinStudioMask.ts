import type { CoinAssessment, CoinBounds, CoinPoint, CoinRaster } from './coinStudioTypes.ts';
function inside(x: number, y: number, points: CoinPoint[]): boolean {
  let yes = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i], b = points[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) yes = !yes;
  }
  return yes;
}
export function coinMaskBounds(source: CoinRaster, mask: CoinRaster, assessment: CoinAssessment): CoinBounds {
  if (source.width !== mask.width || source.height !== mask.height || mask.data.length !== source.width * source.height * 4 || source.data.length !== mask.data.length) throw new Error('Segmentation dimensions differ from the photographic source.');
  if (source.width < 320 || source.height < 320 || source.width * source.height > 3_000_000) throw new Error('Photographic source exceeds safe raster limits.');
  if (!Number.isFinite(assessment.confidence) || assessment.confidence < .95 || !assessment.complete || assessment.occluded || assessment.objectCount !== 1 || !assessment.maskPreservesRim || !assessment.maskPreservesHoles || !assessment.surfaceUnchanged || !assessment.usableDetail || assessment.severeGlare || assessment.outline.length < 12) throw new Error('The rim, holes or genuine surface could not be safely verified.');
  const bounds = { left: mask.width, top: mask.height, right: -1, bottom: -1, count: 0 };
  let expected = 0, missing = 0, holePixels = 0, filledHoles = 0;
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) {
    const alpha = mask.data[(y * mask.width + x) * 4 + 3];
    if (alpha > 0) { bounds.left = Math.min(bounds.left, x); bounds.right = Math.max(bounds.right, x); bounds.top = Math.min(bounds.top, y); bounds.bottom = Math.max(bounds.bottom, y); bounds.count++; }
    // AI geometry only checks the provider mask. It NEVER cuts, fills or reconstructs pixels.
    if (x % 4 || y % 4) continue;
    const px = (x + .5) / mask.width, py = (y + .5) / mask.height;
    if (assessment.holes.some(hole => inside(px, py, hole))) { holePixels++; if (alpha > 32) filledHoles++; }
    else if (inside(px, py, assessment.outline)) { expected++; if (alpha < 128) missing++; }
  }
  if (!expected || missing / expected > .035 || holePixels && filledHoles / holePixels > .04) throw new Error('The segmentation removed surface detail or filled a genuine hole.');
  if (bounds.count < source.width * source.height * .03 || bounds.count > source.width * source.height * .96 || bounds.left < 2 || bounds.top < 2 || bounds.right >= mask.width - 2 || bounds.bottom >= mask.height - 2) throw new Error('The coin mask is empty, clipped or ambiguous.');
  // Do not silently erase specks: a second component may be a real flan fragment or accessory.
  const visited = new Uint8Array(mask.width * mask.height), queue = new Int32Array(visited.length);
  let components = 0;
  for (let p = 0; p < visited.length; p++) {
    if (visited[p] || mask.data[p * 4 + 3] < 128) continue;
    let start = 0, end = 1, size = 0; queue[0] = p; visited[p] = 1;
    while (start < end) { const q = queue[start++]; size++; const x = q % mask.width;
      for (const n of [x > 0 ? q - 1 : -1, x < mask.width - 1 ? q + 1 : -1, q - mask.width, q + mask.width]) if (n >= 0 && n < visited.length && !visited[n] && mask.data[n * 4 + 3] >= 128) { visited[n] = 1; queue[end++] = n; }
    }
    if (size > Math.max(4, bounds.count * .00005)) components++;
  }
  if (components !== 1) throw new Error('More than one foreground component requires original-photo fallback.');
  return bounds;
}
