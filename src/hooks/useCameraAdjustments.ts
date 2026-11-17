import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { boundedCameraZoom, cameraCapabilities, DIGITAL_CAMERA_ZOOM } from '@/lib/cameraZoom';
import type { CaptureCameraSettings } from '@/types/camera';
export function useCameraAdjustments(track: MediaStreamTrack | null) {
  const capabilities = useMemo(() => cameraCapabilities(track), [track]);
  const current = useRef(track); current.current = track;
  const worker = useRef<MediaStreamTrack | null>(null), queued = useRef<number | null>(null);
  const [zoom, setZoom] = useState(1), [digital, setDigital] = useState(false), [zoomBusy, setZoomBusy] = useState(false);
  const [torch, setTorch] = useState(false), [focusBusy, setFocusBusy] = useState(false), [focusMode, setFocusMode] = useState('device');
  const [notice, setNotice] = useState('');
  const range = !digital && capabilities.zoom ? capabilities.zoom : DIGITAL_CAMERA_ZOOM;
  const focusSupported = Boolean(capabilities.focusMode?.some(mode => ['continuous', 'single-shot'].includes(mode)));
  const focus = useCallback(async () => {
    if (!track || track.readyState !== 'live') return;
    const mode = capabilities.focusMode?.includes('continuous') ? 'continuous' : capabilities.focusMode?.includes('single-shot') ? 'single-shot' : null;
    if (!mode) return;
    setFocusBusy(true);
    try {
      await track.applyConstraints({ advanced: [{ focusMode: mode } as MediaTrackConstraintSet] });
      if (current.current === track) { setFocusMode(mode); setNotice(''); }
    } catch { if (current.current === track) { setFocusMode('device'); setNotice('Browser focus control unavailable. Move farther away and use zoom if the coin is blurred.'); } }
    finally { if (current.current === track) setFocusBusy(false); }
  }, [track, capabilities]);
  useEffect(() => {
    queued.current = null; setZoomBusy(false); setFocusBusy(false); setTorch(false); setNotice(''); setFocusMode('device');
    const settings = track?.getSettings() as CaptureCameraSettings | undefined;
    setDigital(!capabilities.zoom); setZoom(capabilities.zoom ? boundedCameraZoom(settings?.zoom ?? capabilities.zoom.min, capabilities.zoom) : 1);
    void focus();
    return () => { if (current.current === track) current.current = null; queued.current = null; };
  }, [track, capabilities, focus]);
  const setCameraZoom = useCallback(async (value: number) => {
    if (!track || track.readyState !== 'live') return;
    const requested = boundedCameraZoom(value, range);
    if (digital || !capabilities.zoom) { setZoom(requested); return; }
    queued.current = requested;
    if (worker.current === track) return;
    worker.current = track; setZoomBusy(true);
    try {
      while (queued.current !== null && current.current === track && track.readyState === 'live') {
        const target = queued.current; queued.current = null;
        await track.applyConstraints({ advanced: [{ zoom: target } as MediaTrackConstraintSet] });
        if (current.current === track) setZoom(boundedCameraZoom((track.getSettings() as CaptureCameraSettings).zoom ?? target, range));
      }
    } catch {
      if (current.current === track) { queued.current = null; setDigital(true); setZoom(1); setNotice('Hardware zoom was refused by this browser. Digital crop zoom is available instead.'); }
    } finally {
      if (worker.current === track) worker.current = null;
      if (current.current === track) setZoomBusy(false);
    }
  }, [track, range, digital, capabilities]);
  const adjust = useCallback(async (value: { zoom?: number; torch?: boolean }) => {
    if (value.zoom !== undefined) await setCameraZoom(value.zoom);
    if (value.torch === undefined || !track || !capabilities.torch) return;
    try {
      await track.applyConstraints({ advanced: [{ torch: value.torch } as MediaTrackConstraintSet] });
      if (current.current === track) setTorch(value.torch);
    } catch { if (current.current === track) setNotice('Flash is unavailable. Use even lighting without glare.'); }
  }, [track, capabilities, setCameraZoom]);
  return { capabilities, zoom, digitalZoom: digital ? zoom : 1, zoomRange: range, zoomKind: digital ? 'digital' as const : 'hardware' as const, zoomBusy, torch, focusBusy, focusMode, focusSupported, notice, adjust, focus };
}
