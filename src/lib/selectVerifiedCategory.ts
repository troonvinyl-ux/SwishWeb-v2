import { verifyListingCategory, CategoryVerificationError } from '@/lib/verifyListingCategory';
import type { TaxonomyRow } from '@/lib/ebayTaxonomyResponse';
import type { CategorySuggestion, CategoryLookupContext, InvokeCategory } from '@/lib/categoryLookup';
interface SelectionInput {
  tenantId: string; rows: TaxonomyRow[]; invoke: InvokeCategory; context: CategoryLookupContext;
  checked: Map<string, CategorySuggestion | null>; failures: string[];
  relevant: (row: TaxonomyRow) => boolean;
}
/** Missing suggestion flags need live proof, not rejection or inferred leaf status. */
export async function selectVerifiedCategory(input: SelectionInput): Promise<CategorySuggestion | null> {
  for (const row of input.rows) {
    // A later compatibility suggestion must not override a failed live check.
    if (row.isLeaf === false || input.checked.has(row.id) && !input.checked.get(row.id)) continue;
    if (row.isLeaf === true && !input.checked.has(row.id)) return row;
    if (!input.checked.has(row.id) && input.checked.size < 3) {
      const checked = await verifyListingCategory(input.tenantId, row, input.invoke, input.context).catch((cause: unknown) => {
        if (!(cause instanceof CategoryVerificationError)) throw cause;
        input.failures.push(cause.message);
        return null;
      });
      input.checked.set(row.id, checked);
    }
    const checked = input.checked.get(row.id);
    if (checked && input.relevant({ ...checked, categoryPath: checked.categoryPath || '', isLeaf: true })) return checked;
  }
  return null;
}
