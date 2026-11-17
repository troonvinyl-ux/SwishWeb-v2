export interface BarcodeReading { value: string; format: string; }
export interface CameraRange { min: number; max: number; step: number; }
export interface CaptureCameraCapabilities { torch?: boolean; zoom?: CameraRange; focusMode?: string[]; }
export interface CaptureCameraSettings extends MediaTrackSettings { zoom?: number; torch?: boolean; focusMode?: string; }
