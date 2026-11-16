import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize, Minimize, AlertCircle } from 'lucide-react';
import { useCaptureCamera } from '@/hooks/useCaptureCamera';
import { useCameraDialog } from '@/hooks/useCameraDialog';
import { useBarcodeScanner } from '@/hooks/useBarcodeScanner';
import { decodeBarcodeImage } from '@/lib/barcodeDecoder';
import type { BarcodeReading } from '@/types/camera';
import CameraViewport from '@/components/features/CameraViewport';
import CameraControls from '@/components/features/CameraControls';
import '@/components/features/captureCamera.css';
interface SharedCaptureCameraProps { label: string; detail: string; disabled: boolean; barcode?: boolean; scanning?: boolean; resolved?: boolean; thumbnail?: string; canReview?: boolean; onPhoto?: (file: File) => void; onBarcode?: (reading: BarcodeReading) => void; }
export default function SharedCaptureCamera({ label, detail, disabled, barcode = false, scanning = false, resolved = false, thumbnail, canReview = true, onPhoto, onBarcode }: SharedCaptureCameraProps) {
  const camera = useCaptureCamera(), [expanded, setExpanded] = useState(true), [grid, setGrid] = useState(true), [taking, setTaking] = useState(false), [fileError, setFileError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null), mounted = useRef(true), takeLock = useRef(false);
  const close = () => setExpanded(false), dialogRef = useCameraDialog(expanded, close);
  const scanner = useBarcodeScanner(camera.video, barcode && scanning && camera.ready && camera.active && !disabled, onBarcode);
  useEffect(() => { if (resolved || disabled) setExpanded(false); }, [resolved, disabled]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const take = async () => {
    if (takeLock.current || disabled) return; takeLock.current = true; setTaking(true); setFileError('');
    await (barcode && camera.video.current ? decodeBarcodeImage(camera.video.current, camera.video.current.videoWidth, camera.video.current.videoHeight).then(reading => { if (!mounted.current) return; if (reading) onBarcode?.(reading); else setFileError('No barcode read. Move closer, avoid glare or enter the printed code.'); }) : camera.capture().then(file => { if (file && mounted.current) onPhoto?.(file); })).catch((cause: unknown) => { if (mounted.current) setFileError(cause instanceof Error ? cause.message : 'Camera unavailable. Choose a photo.'); }).finally(() => { takeLock.current = false; if (mounted.current) setTaking(false); });
  };
  const choose = async (file?: File) => {
    if (!file || disabled) return; setFileError('');
    if (!barcode) { onPhoto?.(file); return; }
    const url = URL.createObjectURL(file);
    const image = new Image();
    await new Promise<HTMLImageElement>((resolve, reject) => { image.onload = () => resolve(image); image.onerror = () => reject(new Error('Choose a JPEG or PNG barcode photo.')); image.src = url; }).then(photo => decodeBarcodeImage(photo, photo.naturalWidth, photo.naturalHeight)).then(reading => { if (!mounted.current) return; if (reading) onBarcode?.(reading); else setFileError('No barcode read from this photo. Enter the printed code.'); }, (cause: unknown) => { if (mounted.current) setFileError(cause instanceof Error ? cause.message : 'Barcode photo could not be read.'); }).finally(() => URL.revokeObjectURL(url));
  };
  const view = <div ref={expanded ? dialogRef : undefined} className={expanded ? 'capture-camera is-expanded' : 'capture-camera'} role={expanded ? 'dialog' : undefined} aria-modal={expanded || undefined} aria-label={expanded ? 'Full-screen camera' : 'Camera'}>
    <header className="capture-camera-heading"><div><h2>{label}</h2><p>{detail}</p></div><button type="button" className="capture-icon" aria-label={expanded ? 'Close full-screen camera' : 'Open full-screen camera'} onClick={() => setExpanded(value => !value)}>{expanded ? <Minimize /> : <Maximize />}</button></header>
    <CameraViewport camera={camera} barcode={barcode} grid={grid} disabled={disabled} onGrid={() => setGrid(value => !value)} />
    {(camera.error || scanner.error || fileError) && <p role="alert" className="capture-camera-error"><AlertCircle size={20} />{fileError || scanner.error || camera.error}</p>}
    <CameraControls camera={camera} disabled={disabled} taking={taking} barcode={barcode} thumbnail={thumbnail} canReview={canReview} onTake={() => void take()} onGallery={() => { close(); fileInput.current?.click(); }} onReview={close} />
    {camera.devices.length > 1 && <details className="capture-device"><summary>Camera / USB microscope</summary><label htmlFor={`camera-${barcode ? 'barcode' : 'photo'}`} className="sr-only">Camera / USB microscope</label><select id={`camera-${barcode ? 'barcode' : 'photo'}`} value={camera.deviceId} disabled={disabled || camera.starting} onChange={event => void camera.open(event.target.value)}>{camera.devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select></details>}
  </div>;
  // Keep the file input mounted while the native photo picker is open, including on iOS.
  return <>{expanded ? createPortal(view, document.body) : view}<input ref={fileInput} type="file" accept="image/*" className="sr-only" disabled={disabled} aria-label={barcode ? 'Choose barcode photo' : 'Choose original photo'} onChange={event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ''; void choose(file); }} />{expanded && <button type="button" className="btn-secondary min-h-12 w-full justify-center" onClick={close}><Minimize size={20} />Review captured photos and continue</button>}</>;
}
