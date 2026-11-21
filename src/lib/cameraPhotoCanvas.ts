import { MAX_CAMERA_PHOTO_PIXELS, cameraDeadline } from '@/lib/cameraStill';
import type { CameraCrop } from '@/lib/cameraZoom';
export function cameraPhotoCanvas(source: CanvasImageSource, crop: CameraCrop): HTMLCanvasElement {
  const scale = Math.min(1, Math.sqrt(MAX_CAMERA_PHOTO_PIXELS / (crop.width * crop.height)));
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.floor(crop.width * scale)); canvas.height = Math.max(1, Math.floor(crop.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo capture is unavailable. Use the device camera or Library instead.');
  context.drawImage(source, crop.x, crop.y, crop.width, crop.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}
export function cameraCanvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Photo could not be saved. Use the device camera instead.')), 'image/jpeg', 0.95));
}
export async function readCameraPhoto(blob: Blob): Promise<{ image: HTMLImageElement; release: () => void }> {
  const url = URL.createObjectURL(blob), image = new Image();
  try {
    await cameraDeadline(new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('Camera still could not be decoded.')); image.src = url; }), 2500);
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('Camera still is empty.');
    return { image, release: () => URL.revokeObjectURL(url) };
  } catch (cause) { URL.revokeObjectURL(url); throw cause; }
}
