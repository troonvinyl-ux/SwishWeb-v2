import type { BarcodeReading } from '@/types/camera';
interface Detector { detect(source: CanvasImageSource): Promise<Array<{rawValue:string;format:string}>>; }
export async function decodeBarcodeImage(source: CanvasImageSource, width: number, height: number): Promise<BarcodeReading | null> {
  if (!width || !height) return null;
  const DetectorClass = (globalThis as unknown as {BarcodeDetector?: new () => Detector}).BarcodeDetector;
  if (DetectorClass) {
    try { const readings=await new DetectorClass().detect(source);if(readings[0])return {value:readings[0].rawValue,format:readings[0].format}; }
    catch { /* Unsupported native format/implementation: use the software decoder. */ }
  }
  const [{ BrowserMultiFormatReader }, { BarcodeFormat }]=await Promise.all([import('@zxing/browser'),import('@zxing/library')]);
  const scale=Math.min(1,1920/Math.max(width,height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
  const context=canvas.getContext('2d');if(!context)throw new Error('Barcode scanning is unavailable in this browser. Enter the printed code instead.');
  context.drawImage(source,0,0,canvas.width,canvas.height);
  try { const result=new BrowserMultiFormatReader().decodeFromCanvas(canvas);return {value:result.getText(),format:String(BarcodeFormat[result.getBarcodeFormat()]).toLowerCase()}; }
  catch(error) { if(error instanceof Error && /NotFound|Checksum|Format/.test(error.name))return null;throw new Error('Barcode could not be decoded. Retake it without glare or enter the printed code.'); }
}
