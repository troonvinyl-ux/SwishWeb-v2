import { useEffect, useState } from 'react';
import { Timer } from 'lucide-react';
import { readScanToLive, SCAN_TO_LIVE_TARGET_SECONDS } from '@/lib/scanToLiveTiming';
interface ListingWorkflowProgressProps { listingKey: string; live: boolean; dirty: boolean; ready: boolean; }
export default function ListingWorkflowProgress({ listingKey, live, dirty, ready }: ListingWorkflowProgressProps) {
  const [now, setNow] = useState(Date.now());
  const timing = readScanToLive(listingKey), finished = Boolean(timing?.liveAt);
  useEffect(() => { if (finished) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [finished, listingKey]);
  const seconds = timing ? Math.max(0, ((timing.liveAt || now) - timing.startedAt) / 1000) : null;
  const stage = finished ? 'Live on eBay — status confirmed' : live ? 'Accepted by eBay — confirming live status' : ready ? 'Ready for your publish confirmation' : dirty ? 'Changes ready to save and check' : 'Review the saved draft';
  return <section aria-label="Scan to live progress" className="swish-card space-y-3 p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 text-lg font-semibold"><Timer size={22} className="text-primary" />Scan to live</h2><span className="text-base font-semibold text-primary">{seconds === null ? '69-second target' : `${seconds.toFixed(1)}s / ${SCAN_TO_LIVE_TARGET_SECONDS}s target`}</span></div><p className="font-medium">{stage}</p><p className="text-base leading-7 text-muted-foreground">One save &amp; check, resolve only conflicting facts, then confirm publication. {timing ? 'Timing includes recognition, uploads, your review and eBay status confirmation; the target is not guaranteed.' : 'No first-photo timestamp is available for this draft; a scan-to-live time cannot be claimed.'}</p></section>;
}
