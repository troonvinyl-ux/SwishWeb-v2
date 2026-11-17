import { useEffect, useRef, useState } from 'react';
import { cameraCrop, containedCameraSize } from '@/lib/cameraZoom';
import type { useCaptureCamera } from '@/hooks/useCaptureCamera';
interface CameraPreviewProps { camera: ReturnType<typeof useCaptureCamera>; barcode: boolean; grid: boolean; coin: boolean; }
export default function CameraPreview({ camera, barcode, grid, coin }: CameraPreviewProps) {
  const container = useRef<HTMLDivElement>(null), [size, setSize] = useState({ width: 0, height: 0 });
  const dimensions = useRef({ width: 0, height: 0 });
  const measure = () => {
    const rect = container.current?.getBoundingClientRect(), video = camera.video.current;
    if (!rect || !video?.videoWidth || !video.videoHeight) return;
    dimensions.current = { width: video.videoWidth, height: video.videoHeight };
    setSize(containedCameraSize(video.videoWidth, video.videoHeight, rect.width, rect.height));
  };
  useEffect(() => {
    const observer = new ResizeObserver(measure);
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const source = dimensions.current;
  const crop = source.width ? cameraCrop(source.width, source.height, camera.digitalZoom) : null;
  return <div ref={container} className="capture-preview-container">
    <div className="capture-preview-plane" style={{ width: size.width || '100%', height: size.height || '100%' }}>
      <video ref={camera.attachVideo} autoPlay playsInline muted style={{ transform: `scale(${crop ? source.width / crop.width : 1}, ${crop ? source.height / crop.height : 1})` }} onCanPlay={event => { measure(); camera.setReady(event.currentTarget.readyState >= 2); }} onLoadedMetadata={measure} onResize={measure} aria-label={barcode ? 'Live barcode camera' : 'Live camera with capture zoom'} />
      {camera.active && camera.ready && <><div aria-hidden="true" className={barcode ? 'capture-frame is-barcode' : coin ? 'capture-frame is-coin' : 'capture-frame'} style={coin && !barcode ? { width: Math.min(size.width, size.height) * 0.72, height: Math.min(size.width, size.height) * 0.72 } : undefined} />{grid && !barcode && <div aria-hidden="true" className="capture-grid">{Array.from({ length: 9 }, (_, index) => <span key={index} />)}</div>}</>}
    </div>
  </div>;
}
