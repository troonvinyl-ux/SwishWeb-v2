import { useCallback, useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { prepareStableQuickCapture as prepareQuickCapture } from '@/lib/listingStudioPreparation';
import type { SwishNicheId } from '@/lib/niche';
import type { CaptureCheckpoint, CaptureDraft, CapturePhoto } from '@/types/capture';
interface CaptureInput { photos: CapturePhoto[]; specialistId: string; mode: string; answers: Record<string, string>; lead?: Record<string, unknown> | null; }
export function useQuickCapture(nicheId: SwishNicheId) {
  const { user } = useAuth(), { tenantId } = useCurrentTenantId(), qc = useQueryClient();
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [draft, setDraft] = useState<CaptureDraft | null>(null), [message, setMessage] = useState(''), [error, setError] = useState('');
  const checkpoint = useRef<CaptureCheckpoint>({}), lock = useRef(false), mounted = useRef(true);
  const key = `${user?.id}:${tenantId}:${nicheId}:${sessionId}`, current = useRef(key); current.current = key;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { checkpoint.current = {}; setDraft(null); setError(''); setMessage(''); }, [key]);
  const preparation = useMutation({ mutationKey: ['quick_capture', key], retry: false,
    mutationFn: async (input: CaptureInput) => {
      const client = await getSupabaseClientAsync();
      if (!client || !user || !tenantId) throw new Error('Open your verified SWISH workspace before using the scanner.');
      const isCurrent = () => mounted.current && current.current === key;
      return prepareQuickCapture({ ...input, scope: { client, userId: user.id, tenantId, nicheId, sessionId, isCurrent }, checkpoint: checkpoint.current,
        onCheckpoint: value => { if (isCurrent()) checkpoint.current = value; }, onProgress: value => { if (isCurrent()) setMessage(value); } });
    },
    onSuccess: value => { if (mounted.current && current.current === key) { setDraft(value); setError(''); toast.success('Draft ready — review before listing or save for later.'); } void qc.invalidateQueries({ queryKey: ['items'] }); void qc.invalidateQueries({ queryKey: ['listings'] }); },
    onError: cause => { if (mounted.current && current.current === key) { setError(cause.message); toast.error(cause.message); } },
  });
  const next = useCallback(async (input: CaptureInput) => {
    if (lock.current || preparation.isPending || draft) return;
    lock.current = true; setError('');
    await preparation.mutateAsync(input).catch(() => undefined).finally(() => { if (current.current === key) lock.current = false; });
  }, [key, preparation, draft]);
  const reset = useCallback(() => { if (!lock.current) setSessionId(crypto.randomUUID()); }, []);
  return { next, reset, draft, sessionId, busy: preparation.isPending, error, message, itemId: checkpoint.current.itemId, listingId: checkpoint.current.listingId, captureLocked: Boolean(checkpoint.current.identification || checkpoint.current.itemId) };
}
