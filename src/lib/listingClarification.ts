export type ListingHelpTarget = 'description' | 'specifics' | 'pricing' | 'photos' | 'delivery' | 'connection' | 'account' | 'status' | 'inventory';
export interface ListingHelp { target: ListingHelpTarget; question: string; actionLabel: string; fields: string[]; }
export function listingClarification(message: string, context: Record<string, unknown> = {}): ListingHelp {
  const help = (target: ListingHelpTarget, question: string, actionLabel: string, fields: string[] = []): ListingHelp => ({ target, question, actionLabel, fields });
  if (context.accepted === true || context.publicationUnconfirmed === true || /RECONCILIATION|UNCONFIRMED/.test(String(context.code || '')) || /accepted listing|do not submit again|already.*submitt|unconfirmed outcome|reconcil|pending.*submission/i.test(message)) return help('status', 'Has eBay already created this listing? Check the existing submission instead of sending another.', 'Refresh existing submission');
  if (/usage limit|selling restriction|selling limit|suspended|restricted account|error 518/i.test(message)) return help('account', 'Can your connected eBay account accept another listing? Item edits cannot resolve an account restriction.', 'Check eBay account');
  if (/auth|reconnect|re-author|token|consent|connector/i.test(message) && !/taxonomy|condition metadata/i.test(message)) return help('connection', 'Is this workspace connected to your selling account with publish permission?', 'Check eBay connection');
  if (/fulfillment|shipping policy|return policy|business polic|seller polic/i.test(message)) return help('delivery', 'Which seller-selected delivery and return policies should this draft use?', 'Review delivery policies');
  const fields = Array.isArray(context.missingRequiredAspects) ? context.missingRequiredAspects.filter((value): value is string => typeof value === 'string').slice(0, 25) : [];
  const field = message.match(/Complete required item specific:\s*(.+?)\.?$/i)?.[1];
  if (fields.length || field || /item specific|aspect|category|leaf|condition/i.test(message)) return help('specifics', 'Which category, condition or item-specific value needs correction? Use factual details and the offered eBay values.', 'Review requested item details', fields.length ? fields : field ? [field] : []);
  if (/photo|image/i.test(message)) return help('photos', 'Which saved item photos should buyers see? Check the selected originals and any upload failure.', 'Review photos');
  if (/price|quantity|reserve|auction|amount/i.test(message)) return help('pricing', 'What price, format and whole quantity should be listed?', 'Review price and quantity');
  if (/safety|recall|manifest|expiry|activation|locked|pressing|sleeve|grade/i.test(message)) return help('inventory', 'Resolve the specific inspection or specialist issue using the saved item; do not change risk flags just to publish.', 'Review specialist facts');
  if (/confidence|identification|title|description/i.test(message)) return help('description', 'Does your title and description reflect the actual item and disclose uncertain attribution? AI confidence is advisory.', 'Review title and description');
  return help('specifics', 'The service check did not finish or did not name a missing field. Retry requirements without creating a duplicate draft.', 'Retry requirements check');
}
