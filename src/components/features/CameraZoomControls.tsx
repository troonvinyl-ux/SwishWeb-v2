import { Focus, Minus, Plus } from 'lucide-react';
import { useId, useState } from 'react';
import type { useCaptureCamera } from '@/hooks/useCaptureCamera';
interface CameraZoomControlsProps { camera: ReturnType<typeof useCaptureCamera>; disabled: boolean; coin: boolean; }
export default function CameraZoomControls({ camera, disabled, coin }: CameraZoomControlsProps) {
  const id = useId(), [requested, setRequested] = useState<number | null>(null);
  const range = camera.zoomRange, value = camera.zoomBusy && requested !== null ? requested : camera.zoom;
  const locked = disabled || !camera.ready || camera.starting;
  const change = (next: number) => { setRequested(next); void camera.adjust({ zoom: next }); };
  const presets = [range.min, ...[1, 2, 3, 4].filter(number => number > range.min && number <= range.max)];
  return <section className="capture-zoom" aria-label="Camera zoom and focus">
    <div className="capture-zoom-heading"><label htmlFor={id}>Zoom <strong>{value.toFixed(1)}×</strong></label><span>{camera.zoomKind === 'hardware' ? 'Camera zoom' : 'Digital crop'}</span></div>
    <div className="capture-zoom-slider"><button type="button" className="capture-icon" disabled={locked || value <= range.min} aria-label="Zoom out" onClick={() => change(Math.max(range.min, value - Math.max(range.step, 0.25)))}><Minus /></button><input id={id} type="range" min={range.min} max={range.max} step={range.step} value={value} disabled={locked} aria-valuetext={`${value.toFixed(1)} times ${camera.zoomKind} zoom`} onChange={event => change(Number(event.target.value))} /><button type="button" className="capture-icon" disabled={locked || value >= range.max} aria-label="Zoom in" onClick={() => change(Math.min(range.max, value + Math.max(range.step, 0.25)))}><Plus /></button></div>
    <div className="capture-zoom-presets">{presets.map(number => <button key={number} type="button" aria-pressed={Math.abs(value - number) < range.step / 2} disabled={locked} onClick={() => change(number)}>{number.toFixed(number % 1 ? 1 : 0)}×</button>)}{camera.focusSupported && <button type="button" className="capture-refocus" disabled={locked || camera.focusBusy || camera.zoomBusy} onClick={() => void camera.focus()}><Focus size={18} />{camera.focusBusy ? 'Focusing…' : 'Refocus'}</button>}</div>
    <p className="capture-focus-note">{camera.focusMode === 'continuous' ? 'Continuous autofocus enabled.' : camera.focusMode === 'single-shot' ? 'Autofocus requested.' : 'Focus is controlled by your device; this browser does not expose autofocus controls.'} {coin ? 'Keep the full rim inside the guide. If blurred, move farther away, then zoom.' : 'Keep your item in the frame.'}{camera.zoomKind === 'digital' && ' Digital zoom crops the saved photo; it does not add detail.'}</p>
  </section>;
}
