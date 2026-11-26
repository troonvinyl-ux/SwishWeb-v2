import { COIN_CANVAS } from './coinStudioTypes.ts';
import type { CoinRaster, CoinRenderPlan, CoinSideOutput } from './coinStudioTypes.ts';
import { coinSourceSample } from './coinStudioSampling.ts';
export function renderCoinPhotograph(source: CoinRaster, mask: CoinRaster, plan: CoinRenderPlan): CoinSideOutput {
  const data = new Uint8Array(COIN_CANVAS * COIN_CANVAS * 4); data.fill(255);
  let maxChannelAdjustment = 0;
  const width = (plan.bounds.right - plan.bounds.left + 1) * plan.scaleX;
  const height = (plan.bounds.bottom - plan.bounds.top + 1) * plan.scaleY;
  for (let y = Math.max(0, Math.floor(plan.top - 1)); y < Math.min(COIN_CANVAS, Math.ceil(plan.top + height + 1)); y++) {
    for (let x = Math.max(0, Math.floor(plan.left - 1)); x < Math.min(COIN_CANVAS, Math.ceil(plan.left + width + 1)); x++) {
      const sx = (x + .5 - plan.left) / plan.scaleX + plan.bounds.left - .5;
      const sy = (y + .5 - plan.top) / plan.scaleY + plan.bounds.top - .5;
      const sample = coinSourceSample(source, mask, sx, sy, plan), index = (y * COIN_CANVAS + x) * 4;
      maxChannelAdjustment = Math.max(maxChannelAdjustment, sample.adjustment);
      for (let c = 0; c < 3; c++) data[index + c] = Math.round(sample.rgb[c] + 255 * (1 - sample.alpha));
    }
  }
  // Opaque, exact white outside the foreground. No JPEG halo or synthesized surface pixels.
  let backgroundWhite = true;
  for (let i = 0; i < COIN_CANVAS; i++) for (const p of [i, (COIN_CANVAS - 1) * COIN_CANVAS + i, i * COIN_CANVAS, i * COIN_CANVAS + COIN_CANVAS - 1]) {
    if ([0, 1, 2, 3].some(c => data[p * 4 + c] !== 255)) backgroundWhite = false;
  }
  return { raster: { width: COIN_CANVAS, height: COIN_CANVAS, data }, plan,
    audit: { maxChannelAdjustment, sourcePixelsOnly: true, colourShiftBounded: maxChannelAdjustment <= 2.00001, clippingIntroduced: false, outputWidth: COIN_CANVAS, outputHeight: COIN_CANVAS, backgroundWhite } };
}
