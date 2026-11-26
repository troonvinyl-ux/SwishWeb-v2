import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRapidCoins } from '@/contexts/RapidCoinContext';
import { changeRapidJob } from '@/lib/rapidCoinDatabase';
import { rapidCanPublish } from '@/types/rapidCoin';
import ListingPublishConfirmation from '@/components/features/ListingPublishConfirmation';
import type { RapidCoinJob } from '@/types/rapidCoin';
import type { useListingEditorActions } from '@/hooks/useListingEditorActions';
interface RapidListingFooterProps { job: RapidCoinJob; actions: ReturnType<typeof useListingEditorActions>; canSubmit: boolean; approved: boolean; loaded: boolean; onNext: () => void; onEdit: () => void; }
/** Approval is transient; the original publication journal is durable. Never capture a stale batch continuation. */
export default function RapidListingFooter({ job, actions, canSubmit, approved, loaded, onNext, onEdit }: RapidListingFooterProps) {
  const queue = useRapidCoins(), [recovering, setRecovering] = useState(false), [confirming, setConfirming] = useState(false);
  const automatic = useRef(false), working = useRef(false), mounted = useRef(true), next = useRef(onNext); next.current = onNext;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const finish = async () => { await queue.refresh(); if (mounted.current) next.current(); };
  const publish = async () => {
    if (working.current || actions.busy || !canSubmit || !rapidCanPublish(job)) return;
    working.current = true;
    await actions.publish().then(success => success ? finish() : queue.refresh()).finally(() => { working.current = false; });
  };
  useEffect(() => {
    if (!approved) { automatic.current = false; return; }
    if (!loaded || automatic.current || actions.busy || working.current) return;
    automatic.current = true;
    if (!canSubmit || !rapidCanPublish(job)) { toast.info(`Coin ${job.sequence} still needs review; no publication sent.`); next.current(); return; }
    void publish();
  }, [approved, loaded, canSubmit, actions.busy, job.id]);
  const save = async () => { if (await actions.save()) await finish(); };
  const defer = async () => { if (await actions.save()) { await changeRapidJob(job.id, job.scope, current => ({ ...current, deferred: true })); await finish(); } };
  const recover = async () => {
    setRecovering(true);
    await (job.externalId && !actions.publicationExternalId ? actions.recoverPending(job.externalId) : actions.checkStatus()).then(() => queue.refresh()).finally(() => { if (mounted.current) setRecovering(false); });
  };
  return <footer className="rapid-footer" aria-label="Rapid coin review actions">
    <button type="button" className="btn-primary" disabled={!canSubmit || actions.busy || !rapidCanPublish(job)} onClick={() => setConfirming(true)}>{actions.publishing ? 'Publishing…' : 'List & Next'}</button>
    <button type="button" className="btn-secondary" disabled={actions.busy || Boolean(actions.reason)} onClick={() => void save()}>Save & Next</button>
    <button type="button" className="btn-secondary" disabled={actions.busy} onClick={onEdit}>Edit</button>
    <button type="button" className="btn-ghost" disabled={actions.busy} onClick={() => void (actions.reason ? finish() : defer())}>Review Later</button>
    {(job.externalId || ['publishing', 'uncertain'].includes(job.publication)) && <button type="button" className="btn-secondary col-span-2" disabled={actions.busy || recovering} onClick={() => void recover()}>Check / recover original submission</button>}
    <p>{actions.reason || actions.error || job.message}</p>
    <ListingPublishConfirmation open={confirming} onOpenChange={setConfirming} onConfirm={() => { setConfirming(false); void publish(); }} />
  </footer>;
}
