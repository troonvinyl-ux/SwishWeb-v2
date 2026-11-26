import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useRapidCoins } from '@/contexts/RapidCoinContext';
import { createRapidJob, changeRapidJob, retainRapidPhoto, rapidJob, rapidJobs } from '@/lib/rapidCoinDatabase';
import type { RapidCoinJob, RapidMode, RapidPhoto } from '@/types/rapidCoin';
/** Serialize camera/import/options operations so the auto-queue timer cannot race an original-photo commit. */
export function useRapidCoinCapture(batchId: string, initialMode: RapidMode = 'envelope') {
  const queue = useRapidCoins(), scope = queue.scope, [job, setJob] = useState<RapidCoinJob | null>(null), [hold, setHold] = useState(false), [saving, setSaving] = useState(false);
  const jobRef = useRef<RapidCoinJob | null>(null), pending = useRef<Promise<unknown>>(Promise.resolve()), current = useRef(''), version = useRef(0), operations = useRef(0);
  current.current = `${scope}:${batchId}`;
  const identity = `${scope}:${batchId}`;
  const accept = (value: RapidCoinJob | null) => { version.current++; jobRef.current = value; if (current.current === identity) setJob(value); };
  useEffect(() => {
    jobRef.current = null; setJob(null); const revision = ++version.current;
    void rapidJobs(scope).then(rows => { if (current.current === identity && version.current === revision) { const unfinished = rows.find(row => row.batchId === batchId && !row.enqueued) || null; jobRef.current = unfinished; setJob(unfinished); } }).catch(() => undefined);
    return () => { current.current = ''; version.current++; };
  }, [scope, batchId]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => { if (operations.current > 0) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', protect); return () => window.removeEventListener('beforeunload', protect);
  }, []);
  const serial = (operation: () => Promise<void>) => {
    operations.current++; setSaving(true);
    const task = pending.current.then(async () => { if (current.current !== identity) throw new Error('Capture workspace changed. Original retained by its seller.'); await operation(); });
    pending.current = task.catch((cause: unknown) => { toast.error(cause instanceof Error ? cause.message : 'Capture could not be saved.'); }).finally(() => { operations.current--; if (current.current === identity && !operations.current) setSaving(false); });
    return task;
  };
  const ensure = async (mode: RapidMode = initialMode) => {
    if (!queue.ready) throw new Error('Verify your coin workspace before capturing.');
    version.current++;
    const local = jobRef.current, fresh = local ? await rapidJob(local.id) : undefined;
    if (fresh && fresh.scope === scope && fresh.batchId === batchId && !fresh.enqueued) return fresh;
    const rows = await rapidJobs(scope), unfinished = rows.find(row => row.batchId === batchId && !row.enqueued);
    if (unfinished) { accept(unfinished); return unfinished; }
    const [userId, tenantId] = scope.split(':'), id = crypto.randomUUID(), now = Date.now();
    const next: RapidCoinJob = { id, userId, tenantId, scope, batchId, sequence: rows.filter(row => row.batchId === batchId).length + 1, mode, createdAt: now, updatedAt: now, photos: [], answers: {}, enqueued: false, processing: 'captured', publication: 'none', checkpoint: {}, message: 'Original photos are retained on this device.' };
    await createRapidJob(next); accept(next); return next;
  };
  const enqueue = useCallback(() => serial(async () => {
    const local = jobRef.current; if (!local) return;
    const fresh = await rapidJob(local.id); if (!fresh || fresh.enqueued) { accept(null); return; }
    if (fresh.photos.length < 2 || fresh.mode === 'envelope' && !fresh.photos.some(photo => photo.slotId === 'envelope')) throw new Error('Capture both coin faces and, in Envelope Mode, the envelope.');
    await changeRapidJob(fresh.id, scope, value => ({ ...value, enqueued: true, message: 'Queued. Capture the next coin while SWISH prepares this draft.' }));
    accept(null); setHold(false); toast.success('Coin queued. Capture the next obverse.');
  }), [scope, batchId]);
  useEffect(() => {
    if (hold || saving || !job || job.photos.length < 3 || job.enqueued) return;
    const timer = setTimeout(() => { void enqueue().catch(() => undefined); }, 2500);
    return () => clearTimeout(timer);
  }, [job, hold, saving, enqueue]);
  const add = (files: File[]) => {
    if (!files.length) return;
    void serial(async () => {
      let active = await ensure();
      for (const file of files) {
        if (current.current !== identity) throw new Error('Seller workspace changed before this photo was saved.');
        if (!file.size || file.type && !file.type.startsWith('image/')) throw new Error('Choose an original image photograph.');
        if (active.photos.length >= 12) throw new Error('Use up to twelve originals per coin; earlier photos remain retained.');
        const index = active.photos.length, slotId = index === 0 ? 'obverse' : index === 1 ? 'reverse' : index === 2 && active.mode === 'envelope' ? 'envelope' : `additional_${index + 1}`;
        const photo: RapidPhoto = { id: crypto.randomUUID(), slotId, label: slotId === 'envelope' ? "Collector's envelope / ticket (internal evidence)" : slotId === 'obverse' ? 'Coin obverse' : slotId === 'reverse' ? 'Coin reverse' : 'Additional identification evidence', role: index < 2 || active.mode === 'standard' ? 'coin' : 'evidence', name: file.name, type: file.type };
        await retainRapidPhoto(active.id, scope, photo, file); active = (await rapidJob(active.id))!;
      }
      accept(active);
    }).catch(() => undefined);
  };
  const configure = (mode: RapidMode, answers: Record<string, string>) => serial(async () => {
    const active = await ensure(mode), saved = await changeRapidJob(active.id, scope, row => { if (row.enqueued) throw new Error('Coin is already queued. Edit its saved draft.'); return { ...row, mode: row.photos.length ? row.mode : mode, answers }; }); accept(saved);
  });
  return { job, hold, setHold, saving, add, enqueue, configure, label: !job?.photos.length ? 'Coin obverse' : job.photos.length === 1 ? 'Coin reverse' : job.photos.length === 2 && job.mode === 'envelope' ? "Collector's envelope / identification ticket" : 'Additional evidence' };
}
