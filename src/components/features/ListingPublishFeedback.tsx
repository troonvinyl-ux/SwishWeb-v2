import { AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
interface ListingPublishFeedbackProps { message: string | null; }
export default function ListingPublishFeedback({ message }: ListingPublishFeedbackProps) {
  if (!message) return null;
  return <section role="alert" className="swish-card min-w-0 space-y-3 p-5"><h2 className="flex items-start gap-2 text-lg font-semibold"><AlertCircle size={22} className="shrink-0 text-warning" />eBay submission response</h2><p className="break-words text-base leading-7">{message}</p><p className="text-base leading-7 text-muted-foreground">This is the shared service’s response. Correct any reported field below and submit again. If eBay’s outcome is unknown or a submission is pending, refresh status and check your eBay listings first.</p><div className="flex flex-wrap gap-3"><Link to="/ebay/account" className="btn-secondary min-h-11">eBay account &amp; policies</Link><Link to="/ebay/logs" className="btn-ghost min-h-11">Submission logs</Link></div></section>;
}
