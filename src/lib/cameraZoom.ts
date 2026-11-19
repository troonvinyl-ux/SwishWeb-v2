import type { CameraRange, CaptureCameraCapabilities } from '@/types/camera';
export interface CameraCrop { x: number; y: number; width: number; height: number; }
export interface CameraPreviewSize { width: number; height: number; }
export function usableCameraRange(value: unknown): CameraRange | null {
  if (!value || typeof value !== 'object') return null;
  const range = value as Partial<CameraRange>;
  if (typeof range.min !== 'number' || typeof range.max !== 'number' || !Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min <= 0 || range.max <= range.min) return null;
  return { min: range.min, max: range.max, step: typeof range.step === 'number' && Number.isFinite(range.step) && range.step > 0 ? range.step : 0.1 };
}
export function cameraCapabilities(track: MediaStreamTrack | null): CaptureCameraCapabilities {
  // Some browsers expose the method but reject capability inspection.
  try {
    const raw = track && typeof track.getCapabilities === 'function' ? track.getCapabilities() as CaptureCameraCapabilities : {};
    return { torch: raw.torch === true, zoom: usableCameraRange(raw.zoom) ?? undefined, focusMode: Array.isArray(raw.focusMode) ? raw.focusMode.filter(value => typeof value === 'string') : [] };
  } catch { return {}; }
}
export function boundedCameraZoom(value: number, range: CameraRange): number {
  if (!Number.isFinite(value)) return range.min;
  const clamped = Math.max(range.min, Math.min(range.max, value));
  const stepped = range.min + Math.round((clamped - range.min) / range.step) * range.step;
  return Number(Math.max(range.min, Math.min(range.max, stepped)).toFixed(4));
}
/** A centre crop at native resolution. Never upscale or redraw coin detail. */
export function cameraCrop(width: number, height: number, zoom: number): CameraCrop {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) throw new Error('Wait for a usable camera frame.');
  const scale = Number.isFinite(zoom) ? Math.max(1, Math.min(4, zoom)) : 1;
  const cropWidth = Math.max(1, Math.floor(width / scale)), cropHeight = Math.max(1, Math.floor(height / scale));
  return { x: (width - cropWidth) / 2, y: (height - cropHeight) / 2, width: cropWidth, height: cropHeight };
}
/** Align a sensor still to the preview field of view, then apply the same digital centre crop. */
export function cameraPhotoCrop(width: number, height: number, previewWidth: number, previewHeight: number, zoom: number): CameraCrop {
  cameraCrop(width, height, 1); cameraCrop(previewWidth, previewHeight, 1);
  const ratio = previewWidth / previewHeight;
  const baseWidth = Math.min(width, height * ratio), baseHeight = Math.min(height, width / ratio);
  const crop = cameraCrop(baseWidth, baseHeight, zoom);
  return { ...crop, x: (width - baseWidth) / 2 + crop.x, y: (height - baseHeight) / 2 + crop.y };
}
/** Preview and captured crop share the same aspect ratio, including portrait/landscape letterboxing. */
export function containedCameraSize(width: number, height: number, availableWidth: number, availableHeight: number): CameraPreviewSize {
  if (Math.min(width, height, availableWidth, availableHeight) <= 0) return { width: 0, height: 0 };
  const scale = Math.min(availableWidth / width, availableHeight / height);
  return { width: width * scale, height: height * scale };
}
export const DIGITAL_CAMERA_ZOOM: CameraRange = { min: 1, max: 4, step: 0.1 };
