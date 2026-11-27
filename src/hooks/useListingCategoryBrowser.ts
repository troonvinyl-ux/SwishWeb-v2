import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { getSupabaseClientAsync } from '@/lib/supabase';
import { scopedCategoryInvoker } from '@/lib/scopedCategoryLookup';
import { readCategoryChildren, categoryTreeRow } from '@/lib/categoryTreeTransport';
import { coinCategoryContext } from '@/lib/coinCategoryContext';
import { coinNavigationPriority } from '@/lib/coinCategoryNavigation';
import { numismaticKind } from '@/lib/coinCategoryPolicy';
import { verifyListingCategory } from '@/lib/verifyListingCategory';
import type { CategorySuggestion } from '@/lib/categoryLookup';
import type { TaxonomyRow } from '@/lib/ebayTaxonomyResponse';
interface BrowserInput {
  userId?: string; tenantId: string | null; nicheId: string; specialistId: string; identity: string; revision: string;
  title: string; attributes: Record<string, unknown>; disabled: boolean; isCurrent: () => boolean; onSelect: (category: CategorySuggestion) => void;
}
/** Interactive native category tree; every leaf is verified before changing the local draft. */
export function useListingCategoryBrowser(input: BrowserInput) {
  const [opened, setOpened] = useState(false), [navigation, setNavigation] = useState<{ identity: string; trail: TaxonomyRow[] }>({ identity: '', trail: [] });
  const identity = `${input.userId}:${input.tenantId}:${input.nicheId}:${input.identity}`;
  const scope = `${identity}:${input.revision}`, current = useRef(scope); current.current = scope;
  useEffect(() => { current.current = scope; return () => { if (current.current === scope) current.current = ''; }; }, [scope]);
  const trail = navigation.identity === identity ? navigation.trail : [], parent = trail[trail.length - 1];
  const isCurrent = () => current.current === scope && input.isCurrent() && !input.disabled;
  const invoke = async () => {
    if (!input.userId || !input.tenantId || !isCurrent()) throw new Error('Reopen your active SWISH workspace before browsing categories.');
    const client = await getSupabaseClientAsync();
    if (!client) throw new Error('The SWISH backend is not connected.');
    return scopedCategoryInvoker({ client, userId: input.userId, tenantId: input.tenantId, nicheId: input.nicheId, isCurrent });
  };
  const query = useQuery({
    queryKey: ['swish-category-browser', identity, input.revision, parent?.id || 'root'],
    enabled: opened && Boolean(input.userId && input.tenantId) && !input.disabled,
    retry: false, staleTime: 60000,
    queryFn: async () => {
      const rows = await readCategoryChildren({ tenantId: input.tenantId!, nicheId: input.nicheId, parentId: parent?.id || null, invoke: await invoke() });
      return rows.map(row => categoryTreeRow(row, trail.map(node => node.name)));
    },
  });
  const mutation = useMutation({
    mutationFn: async (row: TaxonomyRow) => ({ category: await verifyListingCategory(input.tenantId || '', row, await invoke(), { nicheId: input.nicheId, specialistId: input.specialistId, title: input.title, attributes: input.attributes, isCurrent }), scope }),
    onSuccess: result => { if (current.current !== result.scope || !isCurrent()) return; setOpened(false); input.onSelect(result.category); },
    onError: (cause: Error) => toast.error(cause.message),
  });
  const context = coinCategoryContext(input.title, input.attributes), kind = numismaticKind(input.attributes, input.specialistId);
  const rows = (query.data || []).filter(row => coinNavigationPriority(row, context, kind, !trail.length) !== null);
  return {
    opened, trail, parent, rows, empty: query.data?.length === 0, loading: query.isFetching, selecting: mutation.isPending,
    error: mutation.error?.message || query.error?.message || '',
    toggle: () => { mutation.reset(); setOpened(value => !value); }, retry: () => { mutation.reset(); void query.refetch(); },
    enter: (row: TaxonomyRow) => { mutation.reset(); setNavigation({ identity, trail: [...trail, row] }); },
    back: () => { mutation.reset(); setNavigation({ identity, trail: trail.slice(0, -1) }); },
    select: (row: TaxonomyRow) => { if (!input.disabled && !mutation.isPending) mutation.mutate(row); },
  };
}
