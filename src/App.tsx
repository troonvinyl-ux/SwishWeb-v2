import { lazy, Suspense } from 'react';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/layout/AppLayout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Loader2 } from 'lucide-react';
import LoginPage from '@/pages/LoginPage';
import NicheEntry from '@/pages/NicheEntry';
import NicheWorkspace from '@/pages/NicheWorkspace';
import Onboarding from '@/pages/Onboarding';
import Inventory from '@/pages/Inventory';
import InventoryItem from '@/pages/InventoryItem';
import InventoryNew from '@/pages/InventoryNew';
import Identify from '@/pages/Identify';
import NicheCapture from '@/pages/NicheCapture';
import Acquisitions from '@/pages/Acquisitions';
import Opportunities from '@/pages/Opportunities';
import ReviewRequired from '@/pages/ReviewRequired';
import Listings from '@/pages/Listings';
import ListingNew from '@/pages/ListingNew';
import ListingEditor from '@/pages/ListingEditor';
import ListingDetails from '@/pages/ListingDetails';
import Orders from '@/pages/Orders';
import Dispatch from '@/pages/Dispatch';
import Repricing from '@/pages/Repricing';
import Insights from '@/pages/Insights';
import Tasks from '@/pages/Tasks';
import CommandCentre from '@/pages/CommandCentre';
import EbayHub from '@/pages/EbayHub';
import EbayAccount from '@/pages/EbayAccount';
import EbayListings from '@/pages/EbayListings';
import EbayOrders from '@/pages/EbayOrders';
import EbayMessages from '@/pages/EbayMessages';
import EbayOffers from '@/pages/EbayOffers';
import EbayReturns from '@/pages/EbayReturns';
import EbayCases from '@/pages/EbayCases';
import EbayFinances from '@/pages/EbayFinances';
import EbayImport from '@/pages/EbayImport';
import EbayLogs from '@/pages/EbayLogs';
import Settings from '@/pages/Settings';
import MasterAdmin from '@/pages/MasterAdmin';
import NotFound from '@/pages/NotFound';
import SwishFlipHome from '@/pages/SwishFlipHome';
import NicheComingSoon from '@/components/features/NicheComingSoon';
import AuthorizedModule from '@/components/features/AuthorizedModule';
import { getHostProduct, getRouteProduct } from '@/lib/productContext';
import { normaliseNicheId } from '@/lib/niche';
import { isSwishHomeRoute } from '@/lib/homeRouting';
import { ListingStudioProvider } from '@/contexts/ListingStudioContext';
import StudioReview from '@/pages/StudioReview';

const ListingStudio = lazy(() => import('@/pages/ListingStudio'));
const TunesCapture = lazy(() => import('@/pages/TunesCapture'));

const currentHostname = window.location.hostname.toLowerCase().replace(/^www\./, '').split(':')[0];
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false }, mutations: { retry: 0 } } });
const ENTRY_PATHS = ['/stamps', '/stamp-flip', '/stamp-flipper', '/entry/stamps', '/philately', '/coins', '/mx', '/bikes', '/threads', '/clothes', '/surplus', '/cards', '/games', '/antiques', '/home', '/fossils', '/beauty', '/tech', '/electronics', '/tunes', '/tunes-flip', '/tunes_flip', '/music', '/vinyl_records', '/collectibles', '/collectibles-flipper', '/collectibles_flipper'];

function AppRoutes() {
  const { connectionStatus, loading, user, isPlatformOwner, isPlatformOwnerLoading } = useAuth();
  const location = useLocation();
  const isOwner = isPlatformOwner;
  const hostProduct = getHostProduct();
  if (isSwishHomeRoute(currentHostname, location.pathname, Boolean(hostProduct))) return <SwishFlipHome />;
  if (currentHostname.endsWith('.swishflip.co.uk') && !hostProduct) return <NicheComingSoon />;
  const preferredNiche = String(localStorage.getItem('swish_active_niche') || user?.user_metadata?.preferred_niche || 'coins');
  const workspaceNiche = normaliseNicheId(location.pathname.match(/^\/(?:workspace|scan|studio|quick-list)\/([^/]+)/)?.[1]);
  const safeNiche = hostProduct?.id || workspaceNiche || getRouteProduct(location.pathname)?.id || normaliseNicheId(preferredNiche) || 'coins';
  const needsOnboarding = !isOwner && user?.user_metadata?.onboarding_status === 'started';
  const entryWorkspace = needsOnboarding ? '/onboarding' : `/workspace/${safeNiche}`;
  if (connectionStatus === 'initialising' || (loading && connectionStatus === 'connected')) return <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background"><Loader2 className="h-7 w-7 animate-spin text-primary" /><span className="text-sm text-muted-foreground">Connecting to SWISH…</span></div>;
  if (!user) return <LoginPage />;
  if (isPlatformOwnerLoading) return <div role="status" className="flex min-h-screen items-center justify-center gap-3 bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" />Verifying account permissions…</div>;
  // Hostnames select presentation, never grant backend authorization.
  if (hostProduct && !isOwner) {
    const path = location.pathname;
    const commonAllowed = path === '/' || path === '/onboarding' || path.startsWith('/workspace/') || path === '/identify' || path === '/capture' || path === '/antique-capture' || path.startsWith('/identify/') || path.startsWith('/scan/') || path.startsWith('/studio') || path.startsWith('/quick-list/') || path.startsWith('/inventory') || path.startsWith('/listings') || path.startsWith('/orders') || path.startsWith('/dispatch') || path.startsWith('/repricing') || path.startsWith('/insights') || path.startsWith('/money') || path.startsWith('/ebay') || path.startsWith('/settings') || path === '/404';
    const coinOnly = path.startsWith('/acquisitions') || path.startsWith('/opportunities') || path.startsWith('/review-required') || path.startsWith('/audit') || path.startsWith('/tools') || path.startsWith('/command-centre') || path.startsWith('/dashboard') || path.startsWith('/tasks');
    if (!commonAllowed || (hostProduct.id !== 'coins' && coinOnly)) return <Navigate to={`/workspace/${hostProduct.id}`} replace />;
  }
  const moduleRequired = !location.pathname.startsWith('/studio') && !['/onboarding', '/niches', '/master-admin', '/master-admin/', '/ebay/admin', '/404'].includes(location.pathname);
  return <AppLayout key={`${user.id}:${safeNiche}`}><ErrorBoundary name="router"><AuthorizedModule nicheId={safeNiche} enabled={moduleRequired}><Routes>
    <Route path="/" element={<Navigate to={entryWorkspace} replace />} />
    {ENTRY_PATHS.map(path => <Route key={path} path={path} element={<Navigate to={entryWorkspace} replace />} />)}
    <Route path="/workspace/:niche" element={<NicheWorkspace />} />
    <Route path="/onboarding" element={<Onboarding />} />
    <Route path="/niches" element={<NicheEntry />} />
    <Route path="/dashboard" element={<Navigate to={`/workspace/${safeNiche}`} replace />} />
    <Route path="/command-centre" element={<CommandCentre />} />
    <Route path="/inventory" element={<Inventory />} />
    <Route path="/stock-check" element={<NotFound />} />
    <Route path="/inventory/new" element={<InventoryNew />} />
    <Route path="/inventory/:id" element={<InventoryItem />} />
    <Route path="/studio" element={<Suspense fallback={<div role="status">Opening Listing Studio…</div>}><ListingStudio /></Suspense>} />
    <Route path="/studio/:niche" element={<Suspense fallback={<div role="status">Opening Listing Studio…</div>}><ListingStudio /></Suspense>} />
    <Route path="/quick-list/:niche" element={<StudioReview />} />
    <Route path="/identify" element={<Navigate to={`/studio/${safeNiche}`} replace />} />
    <Route path="/capture" element={<Navigate to="/studio" replace />} />
    <Route path="/antique-capture" element={<Navigate to="/scan/antiques" replace />} />
    <Route path="/identify/coins" element={<Navigate to="/scan/coins" replace />} />
    <Route path="/deep-id-lab" element={<Identify />} />
    <Route path="/scan/coins" element={<Identify />} />
    <Route path="/scan/tunes_flip" element={<Suspense fallback={<div role="status" className="swish-card p-6">Loading Tunes Flip…</div>}><TunesCapture /></Suspense>} />
    <Route path="/scan/:niche" element={<NicheCapture />} />
    <Route path="/acquisitions" element={<Acquisitions />} />
    <Route path="/opportunities" element={<Opportunities />} />
    <Route path="/review-required" element={<ReviewRequired />} />
    <Route path="/audit" element={<NotFound />} />
    <Route path="/listings" element={<Listings />} />
    <Route path="/listings/new" element={<ListingNew />} />
    <Route path="/listings/:id" element={<ListingDetails />} />
    <Route path="/listings/:id/edit" element={<ListingEditor />} />
    <Route path="/orders" element={<Orders />} />
    <Route path="/dispatch" element={<Dispatch />} />
    <Route path="/repricing" element={<Repricing />} />
    <Route path="/insights" element={<Insights />} />
    <Route path="/money" element={<NotFound />} />
    <Route path="/tasks" element={<Tasks />} />
    <Route path="/ebay" element={<EbayHub />} />
    <Route path="/ebay/account" element={<EbayAccount />} />
    <Route path="/ebay/admin" element={<MasterAdmin />} />
    <Route path="/ebay/categories" element={<NotFound />} />
    <Route path="/ebay/csv" element={<EbayImport />} />
    <Route path="/ebay/draft-sync-test" element={<NotFound />} />
    <Route path="/stock-listing/:id" element={<InventoryItem />} />
    <Route path="/ebay/listings" element={<EbayListings />} />
    <Route path="/ebay/orders" element={<EbayOrders />} />
    <Route path="/ebay/messages" element={<EbayMessages />} />
    <Route path="/ebay/offers" element={<EbayOffers />} />
    <Route path="/ebay/returns" element={<EbayReturns />} />
    <Route path="/ebay/cases" element={<EbayCases />} />
    <Route path="/ebay/finances" element={<EbayFinances />} />
    <Route path="/ebay/analytics" element={<NotFound />} />
    <Route path="/ebay/import" element={<EbayImport />} />
    <Route path="/ebay/logs" element={<EbayLogs />} />
    <Route path="/tools" element={<NotFound />} />
    <Route path="/tools/islamic-batch" element={<NotFound />} />
    <Route path="/tools/silver-batch" element={<NotFound />} />
    <Route path="/tools/bike-flipper" element={<Navigate to="/scan/bikes" replace />} />
    <Route path="/tools/listing-preflight" element={<NotFound />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="/master-admin" element={<MasterAdmin />} />
    <Route path="/master-admin/" element={<MasterAdmin />} />
    <Route path="*" element={<NotFound />} />
  </Routes></AuthorizedModule></ErrorBoundary></AppLayout>;
}

const App = () => <QueryClientProvider client={queryClient}><TooltipProvider><Toaster /><Sonner position="bottom-right" /><BrowserRouter><ErrorBoundary name="app"><AuthProvider><ListingStudioProvider><AppRoutes /></ListingStudioProvider></AuthProvider></ErrorBoundary></BrowserRouter></TooltipProvider></QueryClientProvider>;
export default App;
