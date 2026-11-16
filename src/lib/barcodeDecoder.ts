import type { BarcodeReading } from '@/types/camera';
interface Detector { detect(source: CanvasImageSource): Promise<Array<{rawValue:string;format:string}>>; }
export async function decodeBarcodeImage(source: CanvasImageSource, width: number, height: number): Promise<BarcodeReading | null> {
  if (!width || !height) return null;
  const DetectorClass = (globalThis as unknown as {BarcodeDetector?: new () => Detector}).BarcodeDetector;
  if (!DetectorClass) throw new Error('Barcode scanning is unavailable in this browser. Enter the printed code instead.');
  const readings = await new DetectorClass().detect(source);
  return readings[0] ? {value:readings[0].rawValue,format:readings[0].format} : null;
}
