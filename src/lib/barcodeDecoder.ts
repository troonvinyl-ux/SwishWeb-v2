import type { BarcodeReading } from '@/types/camera';
interface Detector { detect(source: CanvasImageSource): Promise<Array<{rawValue:string;format:string}>>; }
export async function decodeBarcodeImage(source: CanvasImageSource, width: number, height: number): Promise<BarcodeReading | null> {
  if (!width || !height) return null;
  const DetectorClass = (globalThis as unknown as {BarcodeDetector?: new () => Detector}).BarcodeDetector;
  if (DetectorClass) {
    try { const readings=await new DetectorClass().detect(source);if(readings[0])return {value:readings[0].rawValue,format:readings[0].format}; }
    catch { /* Unsupported native format/implementation: use the software decoder. */ }
  }
  // No optional decoder dependency is bundled in this web build. The camera
  // deliberately reports unsupported scanning instead of showing a fake result;
  // the visible barcode form remains available on every browser.
  throw new Error('Automatic barcode reading is not supported in this browser. Use the printed EAN / UPC / ISBN in the manual barcode field.');
}
