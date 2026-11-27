import { AlertTriangle, ArrowLeft, ChevronRight, ListTree, RefreshCw } from 'lucide-react';
import type { useListingCategoryBrowser } from '@/hooks/useListingCategoryBrowser';
interface ListingCategoryBrowserProps { browser: ReturnType<typeof useListingCategoryBrowser>; disabled: boolean; }
export default function ListingCategoryBrowser({ browser, disabled }: ListingCategoryBrowserProps) {
  const busy = disabled || browser.loading || browser.selecting;
  return <section className="space-y-3 rounded-xl border border-border p-4" aria-label="eBay category browser">
    <button type="button" className="btn-secondary min-h-11 w-full" disabled={disabled || browser.selecting} onClick={browser.toggle} aria-expanded={browser.opened}><ListTree size={20}/>{browser.opened ? 'Close category browser' : 'Browse eBay coin categories'}</button>
    {browser.opened && <div className="space-y-3">
      <p className="text-base leading-7 text-muted-foreground">Browse the existing eBay category tree. Only a verified category matching this coin can be selected.</p>
      {browser.trail.length > 0 && <button type="button" className="btn-ghost min-h-11" disabled={busy} onClick={browser.back}><ArrowLeft size={20}/> Back one level</button>}
      <p className="break-words text-base font-semibold">{browser.trail.map(row => row.name).join(' > ') || 'eBay UK categories'}</p>
      {(browser.loading || browser.selecting) && <p role="status" className="text-base text-muted-foreground">{browser.selecting ? 'Verifying category with eBay…' : 'Loading category branches…'}</p>}
      {browser.error && <div role="alert" className="space-y-2"><p className="flex gap-2 text-base leading-7 text-warning"><AlertTriangle size={20} className="mt-1 shrink-0"/>{browser.error}</p><button type="button" className="btn-secondary min-h-11" disabled={busy} onClick={browser.retry}><RefreshCw size={18}/> Retry category tree</button></div>}
      {!browser.loading && <ul className="space-y-2">{browser.rows.map(row => <li key={row.id}><button type="button" className="btn-secondary min-h-11 w-full justify-between text-left" disabled={busy} onClick={() => row.isLeaf === true ? browser.select(row) : browser.enter(row)}><span className="min-w-0 break-words"><strong className="block text-base">{row.name}</strong><span className="text-sm text-muted-foreground">{row.isLeaf === true ? 'Select verified listing category' : 'Open category branch'}</span></span><ChevronRight size={20} className="shrink-0"/></button></li>)}</ul>}
      {!browser.loading && !browser.error && !browser.rows.length && <p role="status" className="text-base leading-7 text-muted-foreground">No matching child categories here. Go back and choose another branch.</p>}
      {!browser.loading && !browser.error && browser.empty && browser.parent && <button type="button" className="btn-secondary min-h-11" disabled={busy} onClick={() => browser.select(browser.parent!)}>Verify and use {browser.parent.name}</button>}
    </div>}
  </section>;
}
