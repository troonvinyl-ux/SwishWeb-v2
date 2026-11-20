import { useCallback, useEffect, useRef, useState } from 'react';
import { cameraCrop, containedCameraSize } from '@/lib/cameraZoom';
import type { useCaptureCamera } from '@/hooks/useCaptureCamera';
interface CameraPreviewProps { camera: ReturnType<typeof useCaptureCamera>; barcode: boolean; grid: boolean; coin: boolean; record?: boolean; }
export default function CameraPreview({ camera, barcode, grid, coin, record = false }: CameraPreviewProps) {
  const container = useRef<HTMLDivElement>(null), [size, setSize] = useState({ width: 0, height: 0 });
  const [source, setSource] = useState({ width: 0, height: 0 });
  const videoRef = camera.video;
  const measure = useCallback(() => {
    const rect = container.current?.getBoundingClientRect(), video = videoRef.current;
    if (!rect || !video?.videoWidth || !video.videoHeight) return;
    setSource({ width: video.videoWidth, height: video.videoHeight });
    setSize(containedCameraSize(video.videoWidth, video.videoHeight, rect.width, rect.height));
  }, [videoRef]);
  useEffect(() => {
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (container.current) observer?.observe(container.current);
    window.addEventListener('resize', measure); measure();
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure); };
  }, [measure]);
  const crop = source.width ? cameraCrop(source.width, source.height, camera.digitalZoom) : null;
  return <div ref={container} className="capture-preview-container">
    <div className="capture-preview-plane" style={{ width: size.width || '100%', height: size.height || '100%' }}>
      <video ref={camera.attachVideo} autoPlay playsInline muted style={{ transform: `scale(${crop ? source.width / crop.width : 1}, ${crop ? source.height / crop.height : 1})` }} onCanPlay={event => { measure(); camera.setReady(event.currentTarget.readyState >= 2); }} onEmptied={() => camera.setReady(false)} onLoadedMetadata={measure} onResize={measure} aria-label={barcode ? 'Live barcode camera' : 'Live camera with capture zoom'} />
      {camera.active && camera.ready && <><div aria-hidden="true" className={barcode ? 'capture-frame is-barcode' : coin ? 'capture-frame is-coin' : record ? 'capture-frame is-record' : 'capture-frame'} style={(coin || record) && !barcode ? { width: Math.min(size.width, size.height) * (record ? 0.9 : 0.72), height: Math.min(size.width, size.height) * (record ? 0.9 : 0.72) } : undefined} />{grid && !barcode && <div aria-hidden="true" className={record ? 'capture-grid is-record' : 'capture-grid'} style={record ? { width: Math.min(size.width, size.height) * 0.9, height: Math.min(size.width, size.height) * 0.9 } : undefined}>{Array.from({ length: 9 }, (_, index) => <span key={index} />)}</div>}</>}
    </div>
  </div>;
}
