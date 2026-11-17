import { useCallback, useEffect, useRef, useState } from 'react';
import { cameraErrorMessage, releaseCameraStream, requestCameraStream } from '@/lib/cameraStream';
export function useCameraStream() {
  const video = useRef<HTMLVideoElement | null>(null), stream = useRef<MediaStream | null>(null), generation = useRef(0), facing = useRef('environment');
  const [track, setTrack] = useState<MediaStreamTrack | null>(null);
  const [active, setActive] = useState(false), [ready, updateReady] = useState(false), [starting, setStarting] = useState(false), [error, setError] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]), [deviceId, setDeviceId] = useState('');
  const stop = useCallback(() => {
    generation.current++; const previous = stream.current; stream.current = null; releaseCameraStream(previous);
    if (video.current) video.current.srcObject = null;
    setTrack(null); setActive(false); updateReady(false); setStarting(false);
  }, []);
  useEffect(() => {
    const hidden = () => { if (document.hidden) stop(); };
    document.addEventListener('visibilitychange', hidden); window.addEventListener('pagehide', stop);
    return () => { document.removeEventListener('visibilitychange', hidden); window.removeEventListener('pagehide', stop); generation.current++; releaseCameraStream(stream.current); stream.current = null; };
  }, [stop]);
  const attachVideo = useCallback((element: HTMLVideoElement | null) => {
    video.current = element;
    if (element && stream.current) { element.srcObject = stream.current; void element.play().catch(() => { if (video.current === element) setError('Preview could not start. Retry the camera or use the device camera below.'); }); }
  }, []);
  const setReady = useCallback((value: boolean) => updateReady(value && Boolean(stream.current?.getVideoTracks().some(source => source.readyState === 'live'))), []);
  const open = useCallback(async (id?: string) => {
    stop(); const request = generation.current; setStarting(true); setError('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Live camera requires HTTPS and browser camera support. Use the device camera or Library below.');
      const next = await requestCameraStream(navigator.mediaDevices, facing.current, id);
      if (request !== generation.current) { releaseCameraStream(next); return; }
      stream.current = next; const currentTrack = next.getVideoTracks()[0];
      if (!currentTrack) throw new Error('No usable camera stream. Use the device camera below.');
      const settings = currentTrack.getSettings();
      if (settings.facingMode) facing.current = settings.facingMode;
      setTrack(currentTrack); setDeviceId(settings.deviceId || id || ''); setActive(true);
      currentTrack.onended = () => { if (stream.current === next) { stop(); setError('Camera disconnected. Retry or choose another camera.'); } };
      console.log('[SWISH camera] Preview resolution', settings.width, settings.height);
      if (video.current) { video.current.srcObject = next; await video.current.play(); }
      const available = typeof navigator.mediaDevices.enumerateDevices === 'function' ? await navigator.mediaDevices.enumerateDevices().catch(() => [] as MediaDeviceInfo[]) : [];
      if (request === generation.current) setDevices(available.filter(device => device.kind === 'videoinput' && device.deviceId));
    } catch (cause) {
      if (request !== generation.current) return;
      releaseCameraStream(stream.current); stream.current = null;
      setTrack(null); setActive(false); updateReady(false); setError(cameraErrorMessage(cause));
    } finally { if (request === generation.current) setStarting(false); }
  }, [stop]);
  const flip = useCallback(() => { facing.current = facing.current === 'environment' ? 'user' : 'environment'; void open(); }, [open]);
  const isCurrent = useCallback((source: MediaStreamTrack) => stream.current?.getVideoTracks()[0] === source && source.readyState === 'live', []);
  return { video, track, attachVideo, active, ready, setReady, starting, error, devices, deviceId, open, stop, flip, isCurrent };
}
