import { COIN_CANVAS, COIN_FILL } from './coinStudioTypes.ts';
import type { CoinAssessment, CoinBounds, CoinRenderPlan } from './coinStudioTypes.ts';
/** Uniform fit on each face matches maximum visible diameter, without forcing irregular flans circular. */
export function coinRenderPlan(bounds: CoinBounds, assessment: CoinAssessment): CoinRenderPlan {
  const width = bounds.right - bounds.left + 1, height = bounds.bottom - bounds.top + 1;
  const perspective = assessment.perspective;
  const reliable = !assessment.irregular && perspective.reliable && perspective.regularCircular && Number.isFinite(perspective.ratio) && perspective.ratio > 1 && perspective.ratio <= 1.06;
  const correctedX = reliable && perspective.axis === 'x' ? perspective.ratio : 1;
  const correctedY = reliable && perspective.axis === 'y' ? perspective.ratio : 1;
  const scale = COIN_CANVAS * COIN_FILL / Math.max(width * correctedX, height * correctedY);
  // Upsampling changes presentation dimensions, not captured optical resolution.
  if (!Number.isFinite(scale) || scale <= 0 || scale > 3) throw new Error('Insufficient photographed resolution for a safe catalogue presentation.');
  const scaleX = scale * correctedX, scaleY = scale * correctedY;
  const lighting = assessment.lighting;
  const safeLighting = lighting.reliable && Number.isFinite(lighting.x) && Number.isFinite(lighting.y) && Math.abs(lighting.x) <= .02 && Math.abs(lighting.y) <= .02;
  return { bounds, scaleX, scaleY, left: (COIN_CANVAS - width * scaleX) / 2, top: (COIN_CANVAS - height * scaleY) / 2,
    lightingX: safeLighting ? lighting.x : 0, lightingY: safeLighting ? lighting.y : 0, sharpen: assessment.sharpenSafe ? .08 : 0, perspectiveApplied: reliable };
}
export function coinPairGeometrySafe(plans: CoinRenderPlan[]): boolean {
  if (plans.length !== 2) return false;
  const aspects = plans.map(p => (p.bounds.right - p.bounds.left + 1) * p.scaleX / ((p.bounds.bottom - p.bounds.top + 1) * p.scaleY));
  return Math.abs(Math.log(aspects[0] / aspects[1])) <= .08;
}
