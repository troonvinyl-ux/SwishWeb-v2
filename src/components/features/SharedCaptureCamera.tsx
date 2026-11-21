import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize, Minimize, AlertCircle } from 'lucide-react';
import { useCaptureCamera } from '@/hooks/useCaptureCamera';
import { useCameraDialog } from '@/hooks/useCameraDialog';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { decodeBarcodeImage } from '@/lib/barcodeDecoder';
import type { BarcodeReading } from '@/types/camera';
import CameraViewport from '@/components/features/CameraViewport';
import CameraControls from '@/components/features/CameraControls';
import CameraZoomControls from '@/components/features/CameraZoomControls';
import CameraSourceControls from '@/components/features/CameraSourceControls';
import { toast } from 'sonner';
import '@/components/features/captureCamera.css';
interface SharedCaptureCameraProps { label: string; detail: string; disabled: boolean; barcode?: boolean; coin?: boolean; record?: boolean; autoStart?: boolean; scanning?: boolean; resolved?: boolean; thumbnail?: string; canReview?: boolean; onClose?: () => void; onPhoto?: (file: File) => void; onBarcode?: (reading: BarcodeReading) => void; }
export default function SharedCaptureCamera({ label, detail, disabled, barcode = false, coin = false, record = false, autoStart = false, scanning = false, resolved = false, thumbnail, canReview = true, onClose, onPhoto, onBarcode }: SharedCaptureCameraProps) {
  const camera = useCaptureCamera(), [expanded, setExpanded] = useState(true), [grid, setGrid] = useState(true), [taking, setTaking] = useState(false), [fileError, setFileError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null), deviceCameraInput = useRef<HTMLInputElement>(null), mounted = useRef(true), takeLock = useRef(false);
  const close = useCallback(() => { camera.stop(); setExpanded(false); onClose?.(); }, [camera.stop, onClose]);
  const dialogRef = useCameraDialog(expanded, close);
  useEffect(() => { if (autoStart && !disabled && !resolved && expanded) void camera.open(); return camera.stop; }, [autoStart, disabled, resolved, expanded, camera.open, camera.stop]);
  const scanner = useBarcodeScanner(camera.video, barcode && scanning && camera.ready && camera.active && !disabled && !taking, onBarcode);
  useEffect(() => { if (resolved || disabled) setExpanded(false); }, [resolved, disabled]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const take = async () => {
    if (takeLock.current || disabled) return; takeLock.current = true; setTaking(true); setFileError('');
    await (barcode && camera.video.current ? decodeBarcodeImage(camera.video.current, camera.video.current.videoWidth, camera.video.current.videoHeight).then(reading => { if (!mounted.current) return; if (reading) onBarcode?.(reading); else setFileError('No barcode read. Move closer, avoid glare or enter the printed code.'); }) : camera.capture().then(file => { if (file && mounted.current) onPhoto?.(file); })).catch((cause: unknown) => { if (mounted.current) { const message = cause instanceof Error ? cause.message : 'Camera unavailable. Use the device camera or Library.'; setFileError(message); toast.error(message); } }).finally(() => { takeLock.current = false; if (mounted.current) setTaking(false); });
  };
  const choose = async (file?: File) => {
    if (!file || disabled || takeLock.current || !mounted.current) return; setFileError('');
    if (file.type && !file.type.startsWith('image/')) { setFileError('Choose an image photo, not a video or document.'); toast.error('Choose an image photo, not a video or document.'); return; }
    if (!barcode) { onPhoto?.(file); return; }
    takeLock.current = true; setTaking(true);
    const url = URL.createObjectURL(file);
    const image = new Image();
    await new Promise<HTMLImageElement>((resolve, reject) => { image.onload = () => resolve(image); image.onerror = () => reject(new Error('Choose a JPEG or PNG barcode photo.')); image.src = url; }).then(photo => decodeBarcodeImage(photo, photo.naturalWidth, photo.naturalHeight)).then(reading => { if (!mounted.current) return; if (reading) onBarcode?.(reading); else setFileError('No barcode read from this photo. Enter the printed code.'); }, (cause: unknown) => { if (mounted.current) setFileError(cause instanceof Error ? cause.message : 'Barcode photo could not be read.'); }).finally(() => { URL.revokeObjectURL(url); takeLock.current = false; if (mounted.current) setTaking(false); });
  };
  // Open pickers synchronously from a user gesture; do not unmount the coin dialog before a result.
  const picker = (native: boolean) => { if (disabled || taking) return; camera.stop(); setFileError(''); (native ? deviceCameraInput : fileInput).current?.click(); };
  const view = <div ref={expanded ? dialogRef : undefined} className={`${expanded ? 'capture-camera is-expanded' : 'capture-camera'}${record && !barcode ? ' is-record' : ''}`} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={expanded ? 'Full-screen camera' : 'Camera'}>
    <header className="capture-camera-heading"><div><h2>{label}</h2><p>{detail}</p></div><button type="button" className="capture-icon" aria-label={expanded ? 'Close full-screen camera' : 'Open full-screen camera'} onClick={() => expanded ? close() : setExpanded(true)}>{expanded ? <Minimize /> : <Maximize />}</button></header>
    <CameraViewport camera={camera} barcode={barcode} coin={coin} record={record} grid={grid} disabled={disabled || taking} onGrid={() => setGrid(value => !value)} />
    <details className="capture-camera-options" open={record && !barcode ? undefined : true}><summary>Zoom &amp; camera options</summary><div className="capture-options">
      <CameraSourceControls camera={camera} disabled={disabled || taking} coin={coin} onDeviceCamera={() => picker(true)} />
      <CameraZoomControls camera={camera} disabled={disabled || taking} coin={coin} />
      {camera.notice && <p role="status" className="capture-camera-notice">{camera.notice}</p>}
      {(camera.error || scanner.error || fileError) && <p role="alert" className="capture-camera-error"><AlertCircle size={20} />{fileError || scanner.error || camera.error}</p>}
    </div></details>
    <CameraControls camera={camera} disabled={disabled} taking={taking} barcode={barcode} thumbnail={thumbnail} canReview={canReview} onTake={() => void take()} onGallery={() => picker(false)} onReview={close} />
  </div>;
  // Keep both inputs mounted while an OS picker is open, including on iOS. Native files pass through untouched.
  return <>{expanded ? createPortal(view, document.body) : view}<input ref={fileInput} type="file" accept="image/*" className="sr-only" tabIndex={-1} disabled={disabled || taking} aria-label={barcode ? 'Choose barcode photo' : 'Choose original photo'} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void choose(file); }} /><input ref={deviceCameraInput} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} disabled={disabled || taking} aria-label="Take original photo with device camera" onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void choose(file); }} />{expanded && !onClose && <button type="button" className="btn-secondary min-h-12 w-full justify-center" onClick={close}><Minimize size={20} />Review captured photos and continue</button>}</>;
}
