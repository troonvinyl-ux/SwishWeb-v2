import { useEffect, useRef } from 'react';
import { Camera, Images, X, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { useCaptureCamera } from '@/hooks/useCaptureCamera';
import type { StudioCameraExtras } from '@/types/listingStudio';
import CameraPreview from '@/components/features/CameraPreview';
import CameraSourceControls from '@/components/features/CameraSourceControls';
import CameraZoomControls from '@/components/features/CameraZoomControls';
import StudioGuidanceCard from '@/components/features/StudioGuidanceCard';
import StudioPhotoRail from '@/components/features/StudioPhotoRail';
import StudioToolSheet from '@/components/features/StudioToolSheet';
import '@/components/features/listingStudio.css';
interface StudioCameraSurfaceProps extends StudioCameraExtras { camera: ReturnType<typeof useCaptureCamera>; label: string; detail: string; disabled: boolean; taking: boolean; barcode: boolean; coin: boolean; record: boolean; error: string; canReview: boolean; onClose: () => void; onReview: () => void; onTake: () => void; onGallery: () => void; onDevice: () => void; selector?: ReactNode; tools?: ReactNode; onImport?: (files: File[]) => void; }
export default function StudioCameraSurface(props: StudioCameraSurfaceProps) {
  const { camera, disabled, taking, barcode, coin, record, photos = [] } = props, take = useRef(props.onTake); take.current = props.onTake;
  useEffect(() => { const shortcut = (event: KeyboardEvent) => { if (event.code !== 'Space' || event.repeat || disabled || taking || !camera.ready || event.target instanceof HTMLElement && event.target.closest('input,textarea,select,button,[contenteditable="true"]')) return; event.preventDefault(); take.current(); }; document.addEventListener('keydown', shortcut); return () => document.removeEventListener('keydown', shortcut); }, [disabled, taking, camera.ready]);
  return <div className="studio-camera-surface" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!disabled && !taking) props.onImport?.(Array.from(event.dataTransfer.files)); }}>
    <CameraPreview camera={camera} barcode={barcode} coin={coin} record={record} grid={false} />
    <header className="studio-camera-top"><button type="button" className="studio-icon" aria-label="Close camera, retain photos" onClick={props.onClose}><X size={22} /></button><span className="studio-wordmark">SWISH<span> STUDIO</span></span>{props.selector || <span className="studio-niche-pill">{coin ? 'Coins' : record ? 'Music' : 'Photo'}</span>}{camera.capabilities.torch && <button type="button" className="studio-icon" disabled={disabled || taking || camera.zoomBusy} aria-label="Toggle torch" aria-pressed={camera.torch} onClick={() => void camera.adjust({ torch: !camera.torch })}><Zap size={20} /></button>}</header>
    {(!camera.active || !camera.ready) && <div className="studio-camera-fallback"><Camera size={40} /><h1>{camera.starting ? 'Opening camera' : 'Your item, in focus'}</h1><p>{camera.error || 'Start the live camera or choose original photos from your gallery.'}</p><button type="button" disabled={disabled || camera.starting} onClick={() => void camera.open()}>Start / resume camera</button><p>Preview camera access may be restricted. Gallery remains available; test the published site separately.</p></div>}
    <div className="studio-camera-bottom"><StudioGuidanceCard instruction={props.guidance || props.label} detail={props.detail} processing={props.processing || false} /><StudioPhotoRail photos={photos} disabled={disabled || taking} onSelect={props.onSelectPhoto} onRemove={props.onRemovePhoto} onMove={props.onMovePhoto} />{props.error && <p role="alert" className="studio-error">{props.error}</p>}
      {camera.ready && <CameraZoomControls camera={camera} disabled={disabled || taking} coin={coin} compact />}
      <div className="studio-shutter-row"><button type="button" className="studio-gallery" disabled={disabled || taking} onClick={props.onGallery} aria-label="Import original photos from gallery"><Images size={26} /><span>Gallery</span></button><button type="button" className="studio-shutter" disabled={disabled || taking || !camera.ready || camera.zoomBusy || camera.focusBusy} onClick={props.onTake} aria-label={barcode ? 'Read barcode' : 'Take photograph'}><span /></button><button type="button" className="studio-done" disabled={disabled || taking || !props.canReview} onClick={props.onReview}>Done</button></div>
      <StudioToolSheet disabled={disabled || taking}>{props.tools}<p>On desktop, drop original image files anywhere on the camera to import them.</p><CameraSourceControls camera={camera} disabled={disabled || taking} coin={coin} onDeviceCamera={props.onDevice} />{camera.ready && <CameraZoomControls camera={camera} disabled={disabled || taking} coin={coin} />}{camera.notice && <p>{camera.notice}</p>}</StudioToolSheet>
    </div>
  </div>;
}
