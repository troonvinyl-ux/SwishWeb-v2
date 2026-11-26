/** Portable Smart Studio extension; no DOM, network, credentials or generated coin pixels. */
export const COIN_SNAP_VERSION = 'coin-snap-1600-v1';
export const COIN_CANVAS = 1600;
export const COIN_FILL = 0.9;
export interface CoinRaster { width: number; height: number; data: Uint8Array; }
export type CoinPoint = [number, number];
export interface CoinAssessment {
  confidence: number; complete: boolean; occluded: boolean; objectCount: number;
  outline: CoinPoint[]; holes: CoinPoint[][]; maskPreservesRim: boolean; maskPreservesHoles: boolean;
  surfaceUnchanged: boolean; usableDetail: boolean; severeGlare: boolean; irregular: boolean;
  perspective: { reliable: boolean; regularCircular: boolean; axis: 'x' | 'y'; ratio: number };
  lighting: { reliable: boolean; x: number; y: number }; sharpenSafe: boolean;
}
export interface CoinPairAssessment { samePhysicalCoin: boolean; oppositeFaces: boolean; scaleComparable: boolean; faces: CoinAssessment[]; }
export interface CoinBounds { left: number; top: number; right: number; bottom: number; count: number; }
export interface CoinRenderPlan {
  bounds: CoinBounds; scaleX: number; scaleY: number; left: number; top: number;
  lightingX: number; lightingY: number; sharpen: number; perspectiveApplied: boolean;
}
export interface CoinPixelAudit {
  maxChannelAdjustment: number; sourcePixelsOnly: boolean; colourShiftBounded: boolean;
  clippingIntroduced: boolean; outputWidth: number; outputHeight: number; backgroundWhite: boolean;
}
export interface CoinSideOutput { raster: CoinRaster; plan: CoinRenderPlan; audit: CoinPixelAudit; }
