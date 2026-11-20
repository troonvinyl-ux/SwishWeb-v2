import { Camera, Grid3X3, SwitchCamera, Zap } from 'lucide-react';
import type { useCaptureCamera } from '@/hooks/useCaptureCamera';
import CameraPreview from '@/components/features/CameraPreview';
interface CameraViewportProps { camera: ReturnType<typeof useCaptureCamera>; barcode: boolean; coin?: boolean; record?: boolean; grid: boolean; disabled: boolean; onGrid: () => void; }
export default function CameraViewport({ camera, barcode, coin = false, record = false, grid, disabled, onGrid }: CameraViewportProps) {
  return <div className="capture-viewfinder">
    <CameraPreview camera={camera} barcode={barcode} coin={coin} record={record} grid={grid} />
    {(!camera.active || !camera.ready) && <div className="capture-permission"><Camera size={48} /><p>{camera.starting ? 'Opening camera…' : 'Resume the live camera, or use the device camera below.'}</p><button type="button" className="btn-secondary" disabled={disabled || camera.starting} onClick={() => void camera.open()}>{camera.starting ? 'Opening camera…' : 'Start live camera'}</button></div>}
    {camera.active && <div className="capture-settings"><button type="button" disabled={disabled || camera.starting || camera.zoomBusy || camera.focusBusy} className="capture-icon" aria-label="Switch camera" onClick={camera.flip}><SwitchCamera /></button>{!barcode && <button type="button" disabled={disabled} className="capture-icon" aria-label="Toggle framing grid" aria-pressed={grid} onClick={onGrid}><Grid3X3 /></button>}{camera.capabilities.torch && <button type="button" disabled={disabled || camera.starting || camera.zoomBusy || camera.focusBusy} className="capture-icon" aria-label="Toggle camera light" aria-pressed={camera.torch} onClick={() => void camera.adjust({ torch: !camera.torch })}><Zap /></button>}</div>}
  </div>;
}
