import type { CoinRaster, CoinRenderPlan } from './coinStudioTypes.ts';
const luma = (r: number, g: number, b: number) => .2126 * r + .7152 * g + .0722 * b;
/** Provider RGB is ignored completely. Alpha is applied to the ORIGINAL processing-source pixels. */
export function coinSourceSample(source: CoinRaster, mask: CoinRaster, x: number, y: number, plan: CoinRenderPlan): { rgb: number[]; alpha: number; adjustment: number } {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0;
  const rgb = [0, 0, 0]; let alpha = 0, adjustment = 0;
  for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const sx = x0 + dx, sy = y0 + dy;
    if (sx < 0 || sy < 0 || sx >= source.width || sy >= source.height) continue;
    const index = (sy * source.width + sx) * 4, a = mask.data[index + 3] / 255;
    const weight = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * a;
    if (!weight) continue;
    const raw = [source.data[index], source.data[index + 1], source.data[index + 2]];
    const b = plan.bounds, gx = (sx - b.left) / Math.max(1, b.right - b.left) - .5, gy = (sy - b.top) / Math.max(1, b.bottom - b.top) - .5;
    const gain = 1 + Math.max(-.02, Math.min(.02, plan.lightingX * gx + plan.lightingY * gy));
    let sharp = 0;
    if (plan.sharpen && a === 1 && sx > 0 && sy > 0 && sx < source.width - 1 && sy < source.height - 1) {
      const neighbors = [index - 4, index + 4, index - source.width * 4, index + source.width * 4];
      if (neighbors.every(n => mask.data[n + 3] === 255)) sharp = Math.max(-1, Math.min(1, plan.sharpen * (luma(raw[0], raw[1], raw[2]) - neighbors.reduce((sum, n) => sum + luma(source.data[n], source.data[n + 1], source.data[n + 2]), 0) / 4)));
    }
    const values = raw.map(v => v + Math.max(-2, Math.min(2, v * (gain - 1) + sharp)));
    // Never introduce saturation, crushed shadows, white balance, despill or channel-specific colour edits.
    const safe = a === 1 && values.every(v => v > 0 && v < 255);
    for (let c = 0; c < 3; c++) { const value = safe ? values[c] : raw[c]; adjustment = Math.max(adjustment, Math.abs(value - raw[c])); rgb[c] += value * weight; }
    alpha += weight;
  }
  return { rgb, alpha, adjustment };
}
