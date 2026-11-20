import type { useCaptureCamera } from '@/hooks/useCaptureCamera';
interface CameraControlsProps { camera: ReturnType<typeof useCaptureCamera>; disabled: boolean; taking: boolean; barcode: boolean; thumbnail?: string; canReview: boolean; onTake: () => void; onGallery: () => void; onReview: () => void; }
export default function CameraControls({ camera, disabled, taking, barcode, thumbnail, canReview, onTake, onGallery, onReview }: CameraControlsProps) {
  return <div className="capture-controls">
    <button type="button" disabled={disabled || taking} onClick={onGallery}>Library</button>
    <button type="button" className="capture-shutter" disabled={disabled || taking || !camera.active || !camera.ready || camera.starting || camera.zoomBusy || camera.focusBusy} onClick={onTake} aria-label={barcode ? 'Read barcode' : 'Take photograph'}>{taking ? 'Hold still…' : barcode ? 'Scan' : 'Capture'}</button>
    <button type="button" disabled={disabled || taking || !canReview} onClick={onReview}>{thumbnail && <img src={thumbnail} alt="Last captured photo" width="36" height="36" />}Review</button>
  </div>;
}
