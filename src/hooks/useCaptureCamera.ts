import { useCallback, useRef, useState } from 'react';
import { useCameraStream } from '@/hooks/useCameraStream';
import { useCameraAdjustments } from '@/hooks/useCameraAdjustments';
import { cameraStillConstructor } from '@/lib/cameraStill';
import { captureCameraPhoto } from '@/lib/captureCameraPhoto';
import type { CameraPhotoResult } from '@/types/camera';
export function useCaptureCamera() {
  const camera = useCameraStream(), adjustments = useCameraAdjustments(camera.track);
  const failedStill = useRef<MediaStreamTrack | null>(null);
  const [photoResult, setPhotoResult] = useState<Omit<CameraPhotoResult, 'file'> | null>(null);
  const stillAvailable = Boolean(camera.track && cameraStillConstructor() && failedStill.current !== camera.track);
  const { video, ready, track, isCurrent } = camera;
  const capture = useCallback(async (): Promise<File> => {
    const element = video.current;
    if (!element || !ready || !element.videoWidth || !element.videoHeight || !track || !isCurrent(track)) throw new Error('Wait for the camera preview, or use the device camera below.');
    if (adjustments.zoomBusy || adjustments.focusBusy) throw new Error('Wait for camera zoom and focus to finish.');
    const result = await captureCameraPhoto(element, track, adjustments.digitalZoom, isCurrent, stillAvailable);
    if (!isCurrent(track)) throw new Error('Camera changed or closed. Capture again.');
    if (stillAvailable && result.method === 'frame') failedStill.current = track;
    setPhotoResult({ method: result.method, width: result.width, height: result.height });
    console.log('[SWISH camera] Photo source and resolution', result.method, result.width, result.height);
    return result.file;
  }, [video, ready, track, isCurrent, adjustments.digitalZoom, adjustments.zoomBusy, adjustments.focusBusy, stillAvailable]);
  return { ...camera, capture, stillAvailable, photoResult, ...adjustments };
}
