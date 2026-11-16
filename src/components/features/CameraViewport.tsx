import { Camera, Grid3X3, SwitchCamera, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { useCaptureCamera } from '@/hooks/useCaptureCamera';
interface CameraViewportProps { camera: ReturnType<typeof useCaptureCamera>; barcode: boolean; grid: boolean; disabled: boolean; onGrid: () => void; }
export default function CameraViewport({ camera, barcode, grid, disabled, onGrid }: CameraViewportProps) {
  return <div className="capture-viewfinder">
    <video ref={camera.attachVideo} autoPlay playsInline muted onCanPlay={() => camera.setReady(true)} onLoadedMetadata={() => camera.setReady(true)} aria-label={barcode ? 'Live barcode camera' : 'Live camera'} />
    {!camera.active && <div className="capture-permission"><Camera size={48} className="text-primary" /><p>Enable camera access or choose a photo.</p><Button type="button" variant="outline" disabled={disabled || camera.starting} onClick={() => void camera.open()}>{camera.starting ? 'Opening camera…' : 'Enable camera'}</Button></div>}
    {camera.active && <><div aria-hidden="true" className={barcode ? 'capture-frame is-barcode' : 'capture-frame'} />{grid && !barcode && <div aria-hidden="true" className="capture-grid">{Array.from({ length: 9 }, (_, index) => <span key={index} />)}</div>}<div className="capture-settings"><button type="button" disabled={disabled || camera.starting} className="capture-icon" aria-label="Switch camera" onClick={camera.flip}><SwitchCamera /></button>{!barcode && <button type="button" className="capture-icon" aria-label="Toggle framing grid" aria-pressed={grid} onClick={onGrid}><Grid3X3 /></button>}{camera.capabilities.torch && <button type="button" disabled={disabled} className="capture-icon" aria-label="Toggle flash" aria-pressed={camera.torch} onClick={() => void camera.adjust({ torch: !camera.torch })}><Zap /></button>}</div></>}
  </div>;
}
