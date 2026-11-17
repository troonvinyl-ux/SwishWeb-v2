import { AlertCircle, ShieldCheck } from 'lucide-react';

interface NicheAccessStatusProps {
  loading?: boolean;
  error?: Error | null;
  onRetry: () => void;
}

export default function NicheAccessStatus({ loading = false, error, onRetry }: NicheAccessStatusProps) {
  if (loading && !error) return <section role="status" className="swish-card flex items-center gap-3 p-6">
    <ShieldCheck className="h-6 w-6 shrink-0 text-primary" />
    <p className="text-muted-foreground">Checking your SWISH niche memberships…</p>
  </section>;
  return <section role="alert" className="swish-card space-y-4 p-6">
    <h2 className="flex items-center gap-3 text-lg font-semibold"><AlertCircle className="h-6 w-6 shrink-0 text-destructive" />Niche access could not be verified</h2>
    <p className="leading-7 text-muted-foreground">{error?.message || 'Your SWISH workspace is not ready. Complete account setup or retry.'} Your memberships have not been changed.</p>
    <button type="button" disabled={loading} onClick={onRetry} className="btn-secondary min-h-11 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50">{loading ? 'Checking access…' : 'Refresh access'}</button>
  </section>;
}
