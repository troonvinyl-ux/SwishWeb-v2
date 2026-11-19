export interface BarcodeReading { value: string; format: string; }
export interface CameraRange { min: number; max: number; step: number; }
export interface CaptureCameraCapabilities { torch?: boolean; zoom?: CameraRange; focusMode?: string[]; }
export interface CaptureCameraSettings extends MediaTrackSettings { zoom?: number; torch?: boolean; focusMode?: string; }
export interface CameraPhotoCapabilities { imageWidth?: { min?: number; max?: number }; imageHeight?: { min?: number; max?: number }; fillLightMode?: string[]; }
export interface CameraPhotoSettings { imageWidth?: number; imageHeight?: number; fillLightMode?: 'off'; }
export interface CameraStillCapture { takePhoto: (settings?: CameraPhotoSettings) => Promise<Blob>; getPhotoCapabilities?: () => Promise<CameraPhotoCapabilities>; }
export interface CameraStillConstructor { new (track: MediaStreamTrack): CameraStillCapture; }
export interface CameraPhotoResult { file: File; method: 'still' | 'frame'; width: number; height: number; }
