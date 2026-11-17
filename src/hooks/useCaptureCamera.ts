import { useCallback, useEffect, useRef, useState } from 'react';
import { useCameraAdjustments } from '@/hooks/useCameraAdjustments';
import { cameraCrop } from '@/lib/cameraZoom';
export function useCaptureCamera() {
  const video = useRef<HTMLVideoElement | null>(null), stream = useRef<MediaStream | null>(null), generation = useRef(0), facing = useRef('environment');
  const [track, setTrack] = useState<MediaStreamTrack | null>(null);
  const [active, setActive] = useState(false), [ready, setReady] = useState(false), [starting, setStarting] = useState(false), [error, setError] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]), [deviceId, setDeviceId] = useState('');
  const adjustments = useCameraAdjustments(track);
  const stop = useCallback(() => {
    generation.current++; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (video.current) video.current.srcObject = null;
    setTrack(null); setActive(false); setReady(false); setStarting(false);
  }, []);
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { document.removeEventListener('visibilitychange', hidden); generation.current++; stream.current?.getTracks().forEach(track => track.stop()); stream.current = null; };
  }, [stop]);
  const attachVideo = useCallback((element: HTMLVideoElement | null) => {
    video.current = element;
    if (element && stream.current) { element.srcObject = stream.current; void element.play().catch(() => undefined); }
  }, []);
  const open = useCallback(async (id?: string) => {
    stop(); const request = generation.current; setStarting(true); setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera requires HTTPS and a supported browser. Choose a photo instead.');
      const next = await navigator.mediaDevices.getUserMedia({ video: { ...(id ? { deviceId: { exact: id } } : { facingMode: { ideal: facing.current } }), width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false });
      if (request !== generation.current) { next.getTracks().forEach(track => track.stop()); return; }
      stream.current = next;
      const currentTrack = next.getVideoTracks()[0];
      if (!currentTrack) throw new Error('No usable camera stream. Choose a photo instead.');
      setTrack(currentTrack); setDeviceId(currentTrack.getSettings().deviceId || id || ''); setActive(true);
      console.log('[SWISH camera] Ready', currentTrack.getSettings().width, currentTrack.getSettings().height);
      if (video.current) { video.current.srcObject = next; await video.current.play(); }
      const available = await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]);
      if (request === generation.current) setDevices(available.filter(device => device.kind === 'videoinput'));
    } catch (cause) {
      if (request !== generation.current) return;
      stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
      setTrack(null); setActive(false); setReady(false);
      setError(cause instanceof Error && cause.name === 'NotAllowedError' ? 'Camera permission was denied. Allow camera access in browser settings, then retry or choose a photo.' : cause instanceof Error ? cause.message : 'Camera unavailable. Choose a photo.');
    } finally { if (request === generation.current) setStarting(false); }
  }, [stop]);
  const capture = useCallback(async (): Promise<File> => {
    const element = video.current;
    if (!element || !ready || !element.videoWidth || !element.videoHeight || track?.readyState !== 'live') throw new Error('Wait for the camera preview.');
    if (adjustments.zoomBusy || adjustments.focusBusy) throw new Error('Wait for camera zoom and focus to finish.');
    const crop = cameraCrop(element.videoWidth, element.videoHeight, adjustments.digitalZoom);
    const canvas = document.createElement('canvas'); canvas.width = crop.width; canvas.height = crop.height;
    const context = canvas.getContext('2d'); if (!context) throw new Error('Photo could not be captured. Choose a photo instead.');
    context.drawImage(element, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(new File([blob], `swish-${Date.now()}.jpg`, { type: 'image/jpeg' })) : reject(new Error('Photo could not be captured.')), 'image/jpeg', 0.95));
  }, [ready, track, adjustments.digitalZoom, adjustments.zoomBusy, adjustments.focusBusy]);
  const flip = useCallback(() => { facing.current = facing.current === 'environment' ? 'user' : 'environment'; void open(); }, [open]);
  return { video, attachVideo, active, ready, setReady, starting, error, devices, deviceId, open, stop, capture, flip, ...adjustments };
}
