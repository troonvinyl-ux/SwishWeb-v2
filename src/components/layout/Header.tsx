import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ROUTE_LABELS: Record<string, string> = {
  '/command-centre': 'Command Centre',
  '/inventory': 'Inventory',
  '/identify': 'Coin Flipper',
  '/scan/tunes_flip': 'Tunes Flip · Identify Music',
  '/acquisitions': 'Acquisitions',
  '/opportunities': 'Opportunities',
  '/review-required': 'Review Required',
  '/listings': 'Listings',
  '/orders': 'Orders',
  '/dispatch': 'Dispatch',
  '/repricing': 'Repricing',
  '/insights': 'Insights',
  '/tasks': 'Tasks',
  '/ebay': 'eBay Hub',
  '/ebay/listings': 'eBay Listings',
  '/ebay/orders': 'eBay Orders',
  '/ebay/messages': 'eBay Messages',
  '/ebay/offers': 'eBay Offers',
  '/ebay/returns': 'eBay Returns',
  '/ebay/cases': 'eBay Cases',
  '/ebay/finances': 'eBay Finances',
  '/ebay/import': 'eBay Import',
  '/ebay/logs': 'eBay Logs',
  '/settings': 'Settings',
};

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');

  const pageLabel = ROUTE_LABELS[location.pathname] || location.pathname.split('/').filter(Boolean).map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' › ');

  const submitSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = searchVal.trim();
    if (!query) return;
    navigate(`/inventory?q=${encodeURIComponent(query)}`);
    setSearchOpen(false);
    setSearchVal('');
  };

  return (
    <header className="h-14 border-b border-border bg-card flex items-center px-4 gap-3 shrink-0">
      <button onClick={onMenuClick} aria-label="Open navigation" className="lg:hidden flex min-h-11 min-w-11 items-center justify-center rounded-2xl hover:bg-secondary text-muted-foreground hover:text-foreground">
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        {searchOpen ? (
          <form onSubmit={submitSearch} role="search" className="flex items-center gap-2 max-w-sm">
            <input
              autoFocus
              type="search"
              aria-label="Search inventory"
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              placeholder="Search inventory…"
              className="input-field text-sm"
            />
            <button type="submit" disabled={!searchVal.trim()} className="btn-secondary min-h-11" aria-label="Find inventory items">Find</button>
            <button type="button" aria-label="Close inventory search" onClick={() => { setSearchOpen(false); setSearchVal(''); }} className="min-h-11 min-w-11 text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </form>
        ) : (
          <h1 className="text-base font-semibold truncate">{pageLabel}</h1>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button onClick={() => setSearchOpen(!searchOpen)} aria-label={searchOpen ? 'Close inventory search' : 'Search inventory'} className="flex min-h-11 min-w-11 items-center justify-center rounded-2xl hover:bg-secondary text-muted-foreground hover:text-foreground">
          <Search className="w-4 h-4" />
        </button>

      </div>
    </header>
  );
}
