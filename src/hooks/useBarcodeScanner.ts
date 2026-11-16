import { useEffect, useState, type RefObject } from 'react';
import { decodeBarcodeImage } from '@/lib/barcodeDecoder';
import type { BarcodeReading } from '@/types/camera';
export function useBarcodeScanner(video: RefObject<HTMLVideoElement>, enabled: boolean, onReading?: (reading: BarcodeReading) => void) {
  const [error,setError] = useState('');
  useEffect(() => { if (!enabled) return; let stopped=false, busy=false; setError('');
    const timer=window.setInterval(async () => { if(stopped || busy || !video.current) return; busy=true; try { const result=await decodeBarcodeImage(video.current,video.current.videoWidth,video.current.videoHeight); if(result && !stopped) onReading?.(result); } catch(error){ if(!stopped) {setError(error instanceof Error ? error.message : 'Barcode unavailable.'); window.clearInterval(timer);} } finally {busy=false;} },700);
    return () => {stopped=true;window.clearInterval(timer);};
  },[video,enabled,onReading]); return {error};
}
