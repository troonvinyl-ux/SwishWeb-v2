import { cameraCrop, cameraPhotoCrop } from '@/lib/cameraZoom';
import { cameraPhotoCanvas, cameraCanvasBlob, readCameraPhoto } from '@/lib/cameraPhotoCanvas';
import { takeCameraStill } from '@/lib/cameraStill';
import type { CameraPhotoResult } from '@/types/camera';
function photoFile(blob: Blob): File {
  const type = blob.type || 'image/jpeg';
  const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/heic': 'heic', 'image/heif': 'heif' };
  const extension = extensions[type] || 'img';
  return new File([blob], `swish-${Date.now()}.${extension}`, { type });
}
/** The canvas fallback is a shutter-time snapshot, not a later frame after a failed still request. */
export async function captureCameraPhoto(video: HTMLVideoElement, track: MediaStreamTrack, zoom: number, isCurrent: (track: MediaStreamTrack) => boolean, useStill = true): Promise<CameraPhotoResult> {
  const width = video.videoWidth, height = video.videoHeight;
  const fallback = cameraPhotoCanvas(video, cameraCrop(width, height, zoom));
  const blob = useStill ? await takeCameraStill(track) : null;
  if (!isCurrent(track)) throw new Error('Camera changed or closed. Reopen it and capture again.');
  if (blob) {
    try {
      const decoded = await readCameraPhoto(blob);
      try {
        if (!isCurrent(track)) throw new Error('Camera changed or closed. Capture again.');
        const image = decoded.image, crop = cameraPhotoCrop(image.naturalWidth, image.naturalHeight, width, height, zoom);
        if (crop.x === 0 && crop.y === 0 && crop.width === image.naturalWidth && crop.height === image.naturalHeight) {
          return { file: photoFile(blob), method: 'still', width: image.naturalWidth, height: image.naturalHeight };
        }
        const canvas = cameraPhotoCanvas(image, crop), output = await cameraCanvasBlob(canvas);
        if (!isCurrent(track)) throw new Error('Camera changed or closed. Capture again.');
        return { file: photoFile(output), method: 'still', width: canvas.width, height: canvas.height };
      } finally { decoded.release(); }
    } catch { /* Expected unsupported still decoding: retain the shutter-time frame. */ }
  }
  if (!isCurrent(track)) throw new Error('Camera changed or closed. Capture again.');
  const output = await cameraCanvasBlob(fallback);
  if (!isCurrent(track)) throw new Error('Camera changed or closed. Capture again.');
  return { file: photoFile(output), method: 'frame', width: fallback.width, height: fallback.height };
}
