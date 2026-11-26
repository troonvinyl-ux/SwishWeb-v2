import { loadRapidTypescript } from './load-rapid-typescript.mjs';
export const types = loadRapidTypescript('supabase/functions/_shared/coinStudioTypes.ts');
export const maskEngine = loadRapidTypescript('supabase/functions/_shared/coinStudioMask.ts');
export const geometry = loadRapidTypescript('supabase/functions/_shared/coinStudioGeometry.ts', { './coinStudioTypes.ts': types });
export const sampling = loadRapidTypescript('supabase/functions/_shared/coinStudioSampling.ts');
export const renderer = loadRapidTypescript('supabase/functions/_shared/coinStudioRender.ts', { './coinStudioTypes.ts': types, './coinStudioSampling.ts': sampling });
export function coinFixture({ hole = false, irregular = false, colour = [110, 77, 43], radius = 270 } = {}) {
  const width = 700, height = 700, source = { width, height, data: new Uint8Array(width * height * 4) }, mask = { width, height, data: new Uint8Array(width * height * 4) };
  const polygon = Array.from({ length: 64 }, (_, i) => { const angle = i * Math.PI / 32, r = radius * (irregular ? 1 + .025 * Math.sin(angle * 5) : 1); return [(350 + Math.cos(angle) * r) / width, (350 + Math.sin(angle) * r) / height]; });
  const holes = hole ? [Array.from({ length: 32 }, (_, i) => [(420 + Math.cos(i * Math.PI / 16) * 15) / width, (350 + Math.sin(i * Math.PI / 16) * 15) / height])] : [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const angle = Math.atan2(y - 350, x - 350), edge = radius * (irregular ? 1 + .025 * Math.sin(angle * 5) : 1);
    const present = Math.hypot(x - 350, y - 350) <= edge && !(hole && Math.hypot(x - 420, y - 350) <= 15);
    const i = (y * width + x) * 4;
    source.data.set([...(present ? colour.map((v, c) => Math.min(255, Math.max(0, v + (x % 31 === 0 ? -5 : 0) + c))) : [230, 190, 150]), 255], i);
    // Deliberately wrong provider RGB proves that ONLY its alpha can enter the photograph.
    mask.data.set([255, 0, 255, present ? 255 : 0], i);
  }
  const assessment = { confidence: .99, complete: true, occluded: false, objectCount: 1, outline: polygon, holes, maskPreservesRim: true, maskPreservesHoles: true, surfaceUnchanged: true, usableDetail: true, severeGlare: false, irregular,
    perspective: { reliable: false, regularCircular: !irregular, axis: 'x', ratio: 1 }, lighting: { reliable: false, x: 0, y: 0 }, sharpenSafe: false };
  return { source, mask, assessment };
}
export function studioFace(original, side, patch = {}) {
  return { version: 'backgrounderase-3.0.0', presentationVersion: 'coin-snap-1600-v1', status: 'ready', side, originalUri: original, enhancedUri: `https://example.test/studio/${side}.png`, pairKey: 'a'.repeat(64), sourceHash: (side === 'obverse' ? 'b' : 'c').repeat(64), confidence: .99,
    quality: { sourcePixelsOnly: true, fidelityPassed: true, pairPassed: true, scaleMatched: true, colourShiftBounded: true, clippingIntroduced: false, backgroundWhite: true, background: 'pure_white', outputWidth: 1600, outputHeight: 1600, maxChannelAdjustment: 0 }, transform: { outputWidth: 1600, outputHeight: 1600 }, ...patch };
}
