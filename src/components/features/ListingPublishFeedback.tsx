import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listingClarification, type ListingHelp } from '@/lib/listingClarification';
import { describeBackendFailure } from '@/lib/backendAvailability';
interface ListingPublishFeedbackProps { message: string | null; help?: ListingHelp | null; onResolve?: (target: ListingHelp['target']) => void; }
export default function ListingPublishFeedback({ message, help, onResolve }: ListingPublishFeedbackProps) {
  if (!message) return null;
  const guidance = help || listingClarification(message);
  return <section role="alert" className="swish-card min-w-0 space-y-3 p-5 [overflow-wrap:anywhere]"><h2 className="flex items-start gap-2 text-lg font-semibold"><AlertCircle size={22} className="shrink-0 text-warning" />Listing needs attention</h2><p className="text-base leading-7">{guidance.question}</p>{guidance.fields.length > 0 && <p className="font-semibold">Requested fields: {guidance.fields.join(', ')}</p>}<p className="text-base leading-7 text-muted-foreground">{describeBackendFailure(message)}</p><div className="flex flex-wrap gap-3">{onResolve && <button type="button" className="btn-secondary min-h-11" onClick={() => onResolve(guidance.target)}>{guidance.actionLabel}</button>}<Link to="/ebay/account" className="btn-secondary min-h-11">eBay account &amp; policies</Link><Link to="/ebay/logs" className="btn-ghost min-h-11">Submission logs</Link></div></section>;
}
