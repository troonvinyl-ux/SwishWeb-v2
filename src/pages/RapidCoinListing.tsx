import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Camera, ArrowLeft, Layers, Plus } from 'lucide-react';
import { useRapidCoins } from '@/contexts/RapidCoinContext';
import { rapidCanPublish } from '@/types/rapidCoin';
import RapidCoinCamera from '@/components/features/RapidCoinCamera';
import RapidCoinQueueCard from '@/components/features/RapidCoinQueueCard';
import RapidCoinBatchApproval from '@/components/features/RapidCoinBatchApproval';
import RapidCoinReview from '@/components/features/RapidCoinReview';
import '@/components/features/rapidCoin.css';
export default function RapidCoinListing() {
  const queue = useRapidCoins(), [params, setParams] = useSearchParams();
  const [batchId, setBatchId] = useState(() => params.get('batch') || ''), [camera, setCamera] = useState(false), [mode, setMode] = useState<'standard' | 'envelope'>('envelope');
  const [selected, setSelected] = useState<string[]>([]), [confirming, setConfirming] = useState(false), [approved, setApproved] = useState<string[]>([]);
  useEffect(() => { if (!batchId && queue.ready) setBatchId(queue.jobs[queue.jobs.length - 1]?.batchId || crypto.randomUUID()); }, [batchId, queue.jobs, queue.ready]);
  useEffect(() => { setSelected([]); setApproved([]); setCamera(false); }, [queue.scope]);
  const jobs = queue.jobs.filter(job => job.batchId === batchId), reviewing = jobs.find(job => job.id === params.get('review'));
  const open = (id?: string, batch = batchId) => { const next = new URLSearchParams(params); next.delete('section'); next.set('batch', batch); if (id) next.set('review', id); else next.delete('review'); setParams(next, { replace: true }); };
  const next = () => {
    if (approved.length) { const remaining = approved.slice(1); setApproved(remaining); open(remaining[0]); }
    else { const later = jobs.find(job => job.id !== reviewing?.id && job.processing === 'ready' && job.publication === 'none' && !job.deferred && rapidCanPublish(job)); open(later?.id); }
  };
  const eligible = jobs.filter(job => selected.includes(job.id) && rapidCanPublish(job));
  const start = (selectedMode = mode) => { setMode(selectedMode); open(); setCamera(true); };
  if (!queue.ready) return <section className="swish-card space-y-3 p-6"><h1 className="text-xl font-semibold">Opening your Coin Flipper queue</h1><p role={queue.error ? 'alert' : 'status'}>{queue.error || 'Verifying the existing seller workspace and restoring retained captures.'}</p><button type="button" className="btn-secondary min-h-11" onClick={() => void queue.refresh()}>Retry queue storage</button><Link to="/workspace/coins" className="btn-ghost min-h-11">Open Coin Flipper</Link></section>;
  if (camera && batchId) return <RapidCoinCamera batchId={batchId} mode={mode} onClose={() => setCamera(false)} />;
  return <div className="rapid-workspace">
    <header className="rapid-header"><Link to="/workspace/coins" className="btn-ghost min-h-11"><ArrowLeft size={20} />Coin Flipper</Link><button type="button" className="btn-secondary min-h-11" disabled={!batchId || Boolean(queue.error) || approved.length > 0} onClick={() => start()}><Camera size={20} />Capture next</button></header>
    <section className="rapid-hero"><p className="flex items-center gap-2 font-semibold text-primary"><Layers size={20} />SWISHFlip · Rapid Listing</p><h1>Keep capturing. Review when you’re ready.</h1><p className="max-w-3xl text-base leading-7">Three originals start a private coin draft. Collector notes lead research; catalogue and visual evidence stay distinct. Your queue survives navigation and refresh on this device.</p>
      <div className="mt-4 flex flex-wrap gap-3"><button type="button" className="btn-secondary min-h-11" disabled={!batchId || Boolean(queue.error) || approved.length > 0} onClick={() => start('envelope')}>Collector’s Envelope Mode</button><button type="button" className="btn-ghost min-h-11" disabled={!batchId || Boolean(queue.error) || approved.length > 0} onClick={() => start('standard')}>Standard identification</button></div>
      <p className="mt-4 text-muted-foreground">{jobs.length} captured · {jobs.filter(j => j.processing === 'processing').length} processing · {jobs.filter(rapidCanPublish).length} ready · {jobs.filter(j => j.publication === 'published').length} published</p>
    </section>
    {queue.error && <p role="alert" className="mt-4">{queue.error} Capture is paused until persistent storage is available.</p>}
    <div className="rapid-toolbar"><h2 className="mr-auto text-lg font-semibold">Batch review</h2><button type="button" className="btn-ghost min-h-11" disabled={approved.length > 0} onClick={() => { const id = crypto.randomUUID(); setBatchId(id); setSelected([]); open(undefined, id); }}><Plus size={18} />New batch</button>
      <button type="button" className={`${reviewing ? 'btn-secondary' : 'btn-primary'} min-h-11`} disabled={!eligible.length || approved.length > 0} onClick={() => setConfirming(true)}>Approve selected ({eligible.length})</button></div>
    {queue.jobs.length > jobs.length && <label className="mb-4 flex flex-wrap items-center gap-3">Saved batches<select className="input-field max-w-xs" value={batchId} disabled={approved.length > 0} onChange={event => { setBatchId(event.target.value); setSelected([]); open(undefined, event.target.value); }}>{[...new Set(queue.jobs.map(job => job.batchId)), ...(!queue.jobs.some(j => j.batchId === batchId) ? [batchId] : [])].map(id => <option key={id} value={id}>{id === batchId ? 'Current batch' : `Batch · ${new Date(queue.jobs.find(j => j.batchId === id)?.createdAt || Date.now()).toLocaleString()}`}</option>)}</select></label>}
    {approved.length > 0 && <button type="button" className="btn-secondary mb-4 min-h-11" onClick={() => setApproved([])}>Stop batch after current submission</button>}
    <div className="rapid-grid"><section className="min-w-0">{reviewing ? <RapidCoinReview key={reviewing.id} job={reviewing} approved={approved[0] === reviewing.id} onNext={next} /> : <section className="swish-card space-y-4 p-6"><h2 className="text-xl font-semibold">Your collection, one coin at a time</h2><p className="leading-7">Choose a queued coin to open the existing draft editor. Envelope originals are internal evidence by default. Select reviewed drafts for explicit batch publication.</p><p className="leading-7 text-muted-foreground">Two preparation jobs run at a time; publication is sequential. Close or reload cancels batch approval, but never deletes captured originals or replays an uncertain submission.</p></section>}</section>
      <aside className="rapid-queue" aria-label="Persistent coin production queue">{jobs.map(job => <RapidCoinQueueCard key={job.id} job={job} selected={selected.includes(job.id)} onSelect={() => setSelected(values => values.includes(job.id) ? values.filter(id => id !== job.id) : [...values, job.id])} onReview={() => { if (!approved.length) open(job.id); }} />)}{!jobs.length && <p className="swish-card p-5 leading-7">No coins in this batch yet. Start with an obverse, reverse and collector envelope.</p>}</aside></div>
    <RapidCoinBatchApproval count={eligible.length} open={confirming} onOpenChange={setConfirming} onApprove={() => { const ids = eligible.map(job => job.id); setConfirming(false); setApproved(ids); open(ids[0]); }} />
  </div>;
}
