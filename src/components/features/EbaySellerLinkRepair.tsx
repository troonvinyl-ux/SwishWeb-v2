import { useEffect, useRef, useState } from 'react';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { getActiveNicheId } from '@/lib/niche';
import { repairVerifiedEbaySellerLinks, type SellerBindingRepairProgress } from '@/lib/ebaySellerImport';

/** One shared, explicit member-verified eBay repair action.
 * Mount in the normal eBay Hub AND Import page. This does not call eBay
 * End/List/Relist. Existing item IDs are matched server-side and updated only
 * after actual seller-owned eBay IDs have been observed.
 */
export default function EbaySellerLinkRepair({ tenantId }: { tenantId: string | null }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const niche = getActiveNicheId();
  const scope = `${user?.id ?? ''}:${tenantId ?? ''}:${niche}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;

  const [runningScope, setRunningScope] = useState('');
  const running = runningScope === scope;
  const [state, setState] = useState<{
    scope: string;
    progress: SellerBindingRepairProgress | null;
    finished: boolean;
    error: string;
  }>({ scope: '', progress: null, finished: false, error: '' });
  useEffect(() => { scopeRef.current = scope; return () => { scopeRef.current = ''; }; }, [scope]);

  const shown = state.scope === scope ? state : { scope, progress: null, finished: false, error: '' };
  const allowed = Boolean(tenantId && user?.id && niche === 'coins');
  const run = async () => {
    if (!allowed || running || !tenantId || !user) return;
    const capturedScope = scope;
    setRunningScope(capturedScope);
    setState({scope: capturedScope, progress: null, finished: false, error: ''});
    try {
      const client = await getSupabaseClientAsync();
      if (!client) throw new Error('SWISH is not connected.');
      const result = await repairVerifiedEbaySellerLinks(client, user.id, tenantId, 'coins', progress => {
        if (scopeRef.current === capturedScope) {
          setState({scope: capturedScope, progress, finished: false, error: ''});
        }
      });
      if (scopeRef.current !== capturedScope || getActiveNicheId() !== 'coins') return;
      await Promise.all(['items', 'listings', 'canonical-inventory'].map(key =>
        qc.invalidateQueries({ queryKey: [key] })
      ));
      if (scopeRef.current === capturedScope) {
        setState({scope: capturedScope, progress: result, finished: true, error: ''});
      }
    } catch (cause) {
      if (scopeRef.current === capturedScope) {
        setState({
          scope: capturedScope,
          progress: null,
          finished: false,
          error: cause instanceof Error ? cause.message : 'The verified eBay seller re-import could not be confirmed.',
        });
      }
    } finally {
      if (scopeRef.current === capturedScope) setRunningScope('');
    }
  };

  return <section aria-label="Repair eBay links for Coins" data-swish-ebay-repair="coins"
    className="swish-card border-primary/30 p-4 sm:p-5 space-y-3">
    <div className="flex items-start gap-3">
      <ShieldCheck className="h-5 w-5 shrink-0 text-primary mt-0.5" />
      <div className="min-w-0 space-y-1">
        <h2 className="text-base font-semibold">Repair existing eBay coin links</h2>
        <p className="text-xs text-muted-foreground">
          Read your verified seller's existing eBay listings and automatically fill the missing
          member, eBay account and binding IDs on matching SWISH coins. No CSV upload, duplicate
          imports, relisting, ending or changes to inventory status.
        </p>
      </div>
    </div>
    <button type="button" onClick={() => void run()} disabled={!allowed || running}
      className="btn-primary min-h-11 disabled:opacity-50"
      data-testid="ebay-seller-binding-repair">
      <RefreshCw size={17} className={running ? 'animate-spin' : ''} />
      {running ? 'Re-importing verified eBay links…' : 'Re-import & Repair eBay Links'}
    </button>
    {niche !== 'coins' && <p className="text-xs text-warning">
      Open Coin Flipper before running the coin ownership repair.
    </p>}
    {niche === 'coins' && !tenantId && <p className="text-xs text-warning">
      Select your SWISH account before running the repair.
    </p>}
    {shown.progress && <p role="status" className="text-sm break-words">
      Seller {shown.progress.verifiedSeller} · {shown.progress.section} page {shown.progress.page}/{shown.progress.totalPages} ·
      {' '}{shown.progress.updated} repaired · {shown.progress.alreadyLinked} already correct ·
      {' '}{shown.progress.conflicts} conflicts · {shown.progress.unlinked} unlinked ·
      {' '}{shown.progress.otherNiche} other niches
      {shown.finished ? ' · Complete' : ''}
    </p>}
    {shown.error && <p role="alert" className="text-xs text-destructive break-words">
      {shown.error} Earlier confirmed pages remain saved; refresh and retry if needed.
    </p>}
  </section>;
}
