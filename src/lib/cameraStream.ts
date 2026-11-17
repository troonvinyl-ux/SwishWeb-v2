export function cameraVideoConstraints(facing: string, deviceId?: string): MediaTrackConstraints {
  return { ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: facing } }), width: { ideal: 2560 }, height: { ideal: 1920 }, aspectRatio: { ideal: 4 / 3 } };
}
/** Retry only unsupported constraints, never permission denials or a busy camera. */
export async function requestCameraStream(media: MediaDevices, facing: string, deviceId?: string): Promise<MediaStream> {
  try { return await media.getUserMedia({ video: cameraVideoConstraints(facing, deviceId), audio: false }); }
  catch (cause) {
    const name = cause instanceof Error ? cause.name : '';
    if (name !== 'OverconstrainedError' && !(deviceId && name === 'NotFoundError')) throw cause;
    return media.getUserMedia({ video: { facingMode: { ideal: facing } }, audio: false });
  }
}
export function cameraErrorMessage(cause: unknown): string {
  const name = cause instanceof Error ? cause.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Allow camera access in browser settings, or use the device camera below. Embedded previews may block camera access.';
  if (name === 'NotReadableError' || name === 'AbortError') return 'The camera is busy. Close other camera apps and retry, or use the device camera below.';
  if (name === 'NotFoundError') return 'No browser camera found. Connect a camera or use the device camera / Library below.';
  return cause instanceof Error ? cause.message : 'Camera unavailable. Use the device camera or Library below.';
}
export function releaseCameraStream(stream: MediaStream | null) {
  stream?.getTracks().forEach(track => { track.onended = null; track.stop(); });
}
