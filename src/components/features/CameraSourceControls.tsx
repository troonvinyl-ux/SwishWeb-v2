import { useId } from 'react';
import { Camera } from 'lucide-react';
import type { useCaptureCamera } from '@/hooks/useCaptureCamera';
interface CameraSourceControlsProps { camera: ReturnType<typeof useCaptureCamera>; disabled: boolean; onDeviceCamera: () => void; coin: boolean; }
export default function CameraSourceControls({ camera, disabled, onDeviceCamera, coin }: CameraSourceControlsProps) {
  const id = useId(), settings = camera.track?.getSettings();
  return <section className="capture-sources" aria-label="Camera source">
    <div className="capture-source-actions"><button type="button" className="capture-device-camera" disabled={disabled} onClick={onDeviceCamera}><Camera size={20} />Use device camera</button>
      {camera.devices.length > 1 && <div className="capture-device"><label htmlFor={id}>Camera / lens</label><select id={id} value={camera.deviceId} disabled={disabled || camera.starting || camera.zoomBusy || camera.focusBusy} onChange={event => void camera.open(event.target.value)}>{!camera.devices.some(device => device.deviceId === camera.deviceId) && <option value={camera.deviceId}>Browser-selected camera</option>}{camera.devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Camera ${index + 1}`}</option>)}</select></div>}
    </div>
    <details className="capture-quality"><summary>Photo quality and focus tips</summary><p className="capture-source-note">On phones, device camera opens the camera app where supported for its own focus and zoom. Other browsers may open a file picker.</p>
      <p className="capture-source-note">{coin ? 'Try each rear lens for the sharpest coin detail. Lens names and macro availability depend on the browser.' : 'Choose the camera with the clearest view of your item.'} USB microscopes work when exposed as browser cameras.</p>
      {camera.active && settings?.width && settings?.height && <p className="capture-source-note">Live preview: {settings.width} × {settings.height}. {camera.stillAvailable ? 'Sensor still capture will be attempted.' : 'Using a preview-frame photo; the device camera may provide more detail.'}</p>}
      {camera.photoResult && <p className="capture-source-note" role="status">Last photo: {camera.photoResult.width} × {camera.photoResult.height} · {camera.photoResult.method === 'still' ? 'Sensor still' : 'Preview frame'}. No artificial sharpening applied.</p>}
    </details>
  </section>;
}
