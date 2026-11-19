import type { CameraStillConstructor, CameraPhotoCapabilities, CameraPhotoSettings } from '@/types/camera';
export const MAX_CAMERA_PHOTO_PIXELS = 12_000_000;
export function cameraStillConstructor(): CameraStillConstructor | null {
  const constructor = (globalThis as typeof globalThis & { ImageCapture?: CameraStillConstructor }).ImageCapture;
  return typeof constructor === 'function' ? constructor : null;
}
export function cameraPhotoSettings(capabilities: CameraPhotoCapabilities): CameraPhotoSettings {
  const width = capabilities.imageWidth?.max, height = capabilities.imageHeight?.max;
  const settings: CameraPhotoSettings = {};
  if (typeof width === 'number' && typeof height === 'number' && Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
    const scale = Math.min(1, Math.sqrt(MAX_CAMERA_PHOTO_PIXELS / (width * height)));
    settings.imageWidth = Math.max(1, Math.floor(width * scale)); settings.imageHeight = Math.max(1, Math.floor(height * scale));
  }
  if (capabilities.fillLightMode?.includes('off')) settings.fillLightMode = 'off';
  return settings;
}
/** Every timeout is cleared, and late API rejections are consumed by Promise.race. */
export async function cameraDeadline<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Camera still capture timed out.')), milliseconds); });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}
/** Feature-detect per track. Advertised API support is not proof that a still will succeed. */
export async function takeCameraStill(track: MediaStreamTrack, constructor = cameraStillConstructor()): Promise<Blob | null> {
  if (!constructor || track.readyState !== 'live') return null;
  try {
    const capture = new constructor(track);
    const capabilities = typeof capture.getPhotoCapabilities === 'function' ? await cameraDeadline(capture.getPhotoCapabilities(), 800).catch(() => ({} as CameraPhotoCapabilities)) : {};
    if (track.readyState !== 'live') return null;
    const blob = await cameraDeadline(capture.takePhoto(cameraPhotoSettings(capabilities)), 3500);
    return blob?.size > 0 && (!blob.type || blob.type.startsWith('image/')) ? blob : null;
  } catch { return null; }
}
