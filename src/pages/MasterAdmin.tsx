import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { callEdgeFunction } from '@/lib/supabase';
import { BadgeCheck, Crown, RefreshCw, ShieldAlert, Package, CheckCircle2 } from 'lucide-react';
import { PRODUCTS } from '@/lib/productContext';
import { toast } from 'sonner';

type Subscription = {
  subscribed?: boolean;
  product_id?: string | null;
  price_id?: string | null;
  subscription_end?: string | null;
  niche_entitlements?: string[];
};

const NICHES = PRODUCTS.map(product => ({
  id: product.id, name: product.name, tagline: product.description,
  colour: product.accent,
}));

export default function MasterAdmin() {
  const { isPlatformOwner, isPlatformOwnerLoading } = useAuth();
  const navigate = useNavigate();
  const isOwner = isPlatformOwner;
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const activeNiche = localStorage.getItem('swish_active_niche') || 'coins';

  const switchNiche = (niche: typeof NICHES[number]) => {
    localStorage.setItem('swish_active_niche', niche.id);
    localStorage.setItem('swish_active_niche_name', niche.name);
    document.documentElement.dataset.niche = niche.id;
    navigate('/workspace/' + niche.id);
  };

  const refresh = useCallback(async () => {
    if (!isOwner) return;
    setLoading(true);
    const result = await callEdgeFunction<Subscription>('swish-check-subscription', {});
    setLoading(false);
    setCheckedAt(new Date().toISOString());
    if (result.error) {
      setSubscription(null);
      toast.error('Could not check subscription: ' + result.error.message);
      return;
    }
    setSubscription(result.data ?? null);
  }, [isOwner]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (isPlatformOwnerLoading) return <div role="status" className="swish-card p-6">Verifying owner access…</div>;
  if (!isOwner) {
    return <div className="max-w-xl mx-auto mt-12 swish-card p-8 text-center space-y-3"><ShieldAlert className="w-10 h-10 mx-auto text-destructive" /><h1 className="text-xl font-bold">Owner access only</h1><p className="text-sm text-muted-foreground">The SWISH master administration dashboard is restricted to the owner account.</p></div>;
  }

  const entitlements = subscription?.niche_entitlements ?? [];
  const subscriptionEnd = subscription?.subscription_end ? new Date(subscription.subscription_end).toLocaleDateString('en-GB') : '—';

  return <div className="space-y-6 animate-fade-in">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><div className="flex items-center gap-2"><Crown className="w-6 h-6 swish-gold" /><h1 className="page-title">Master Admin</h1></div><p className="page-subtitle">Owner workspace selector and actual subscription details</p></div>
      <button onClick={() => void refresh()} disabled={loading} className="btn-secondary"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />Refresh status</button>
    </div>

    <section className="swish-card p-5 space-y-4">
      <div className="flex items-center gap-2"><BadgeCheck className="w-5 h-5 swish-gold" /><h2 className="font-semibold">Master workspace switcher</h2></div>
      <p className="text-sm text-muted-foreground">As master admin, open any registered production niche. Stock and workflows remain context-specific, just like the app.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {NICHES.map(niche => { const active = activeNiche === niche.id; return <button key={niche.id} onClick={() => switchNiche(niche)} className={`master-niche-card ${active ? 'is-active' : ''}`} style={{ '--niche-color': niche.colour } as React.CSSProperties}>
          <span className="master-niche-icon"><Package className="w-6 h-6" /></span><span className="master-niche-copy"><strong>{niche.name}</strong><small>{niche.tagline}</small></span>{active ? <span className="master-niche-active"><CheckCircle2 className="w-4 h-4" />ACTIVE</span> : <span className="master-niche-arrow">›</span>}
        </button>; })}
      </div>
    </section>

    <section className="swish-card p-5 space-y-4">
      <div className="flex items-center gap-2"><BadgeCheck className="w-5 h-5 swish-gold" /><h2 className="font-semibold">Current owner subscription</h2></div>
      {loading && !subscription ? <p className="text-sm text-muted-foreground">Checking subscription service…</p> : subscription ? <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="stat-card"><div className="text-xs text-muted-foreground">Stripe subscription</div><div className="text-xl font-bold mt-1">{subscription.subscribed ? 'Active' : 'Not active'}</div></div>
          <div className="stat-card"><div className="text-xs text-muted-foreground">Entitled niches</div><div className="text-xl font-bold mt-1">{entitlements.length}</div><div className="text-xs text-muted-foreground mt-1">{entitlements.length ? entitlements.join(', ') : 'No Stripe niche entitlement returned'}</div></div>
          <div className="stat-card"><div className="text-xs text-muted-foreground">Subscription period ends</div><div className="text-lg font-bold mt-1">{subscriptionEnd}</div></div>
        </div>
        <p className="text-xs text-muted-foreground">Last checked: {checkedAt ? new Date(checkedAt).toLocaleString('en-GB') : '—'}. This is the authenticated owner account’s result, not a list of all subscribers.</p>
      </> : <p className="text-sm text-muted-foreground">No subscription status is available. Refresh to try again.</p>}
    </section>

    <div><Link to="/niches" className="btn-secondary">Back to SWISH Verticals</Link></div>
  </div>;
}
