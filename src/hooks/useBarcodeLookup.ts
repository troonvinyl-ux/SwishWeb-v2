import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { normalizeProductBarcode, sameProductBarcode } from '@/lib/productBarcode';
import { captureRequest, captureRecord, captureText } from '@/lib/captureRequest';
import type { CaptureScope } from '@/types/capture';
import type { BarcodeReading } from '@/types/camera';
export function useBarcodeLookup(scope: CaptureScope) {
  const [busy, setBusy] = useState(false), [code, setCode] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const flight = useRef(false), serial = useRef(0), alive = useRef(true), scopeRef = useRef(scope); scopeRef.current = scope;
  useEffect(() => { alive.current = true; return () => { alive.current = false; serial.current++; }; }, []);
  const lookup = useCallback(async (reading: BarcodeReading) => {
    const gtin = normalizeProductBarcode(reading.code, reading.type);
    if (!gtin) { setError('Invalid EAN/UPC/ISBN check digit. Rescan or edit the barcode.'); return; }
    if (flight.current) return;
    const captured = scopeRef.current, version = ++serial.current, valid = () => alive.current && captured.isCurrent() && version === serial.current;
    flight.current = true; setCode(gtin); setBusy(true); setError(''); setMessage(''); setProducts([]);
    console.log('[SWISH barcode] Valid code read; starting one scoped product lookup.');
    await captureRequest(captured, 'swish-ebay-browse', { route: 'barcode_lookup', gtin }).then(data => {
      if (!valid()) return;
      const matches = Array.isArray(data.products) ? data.products.map(captureRecord).filter(lead => captureText(lead.id) && captureText(lead.title) && ['eBay Browse', 'OnSpace AI', 'Discogs'].includes(captureText(lead.source)) && sameProductBarcode(normalizeProductBarcode(captureText(lead.gtin)) || '', gtin)) : [];
      setProducts(matches); setMessage(captureText(data.message) || (matches.length ? 'Choose the matching product and edition.' : 'No credible match. Add photos or edit details.'));
      if (!matches.length && data.status === 'unavailable') setError(captureText(data.message) || 'Product lookup unavailable. Add photos or retry explicitly.');
    }, (cause: unknown) => { if (valid()) { const detail = cause instanceof Error ? cause.message : 'Barcode lookup unavailable.'; setError(detail); toast.error(detail); } }).finally(() => { flight.current = false; if (valid()) setBusy(false); });
  }, []);
  const reset = useCallback(() => { if (flight.current) return; serial.current++; setCode(''); setProducts([]); setMessage(''); setError(''); }, []);
  return { lookup, reset, busy, code, error, message, products };
}
