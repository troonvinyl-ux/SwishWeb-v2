import { coinAttribution, COIN_FACT_LABELS } from '@/lib/coinAttribution';
import { COIN_FACT_KEYS } from '@/lib/coinFactNormalization';
import { listingDescriptionText } from '@/lib/listingPresentation';
const HEADING = 'Attribution and recorded details';
const trimTitle = (value: string) => value.length <= 80 ? value : value.slice(0, 81).replace(/\s+\S*$/, '').slice(0, 80);
/** Draft-only copy assembly. Existing seller copy is changed only by an explicit editor action. */
export function assembleCoinAttributionCopy(generated: Record<string, unknown>, attributes: Record<string, unknown>): Record<string, unknown> {
  const attribution = coinAttribution(attributes, String(generated.title || ''));
  let title = String(generated.title || '').trim();
  const generic = /^(?:(?:unknown|unidentified|unresolved|worn|collectible|silver|copper|bronze)\s+)*(?:coin|object)[.!?]?$/i.test(title);
  const identity = [attribution.facts.country?.value, attribution.facts.denomination?.value, attribution.facts.year?.value, attribution.facts.ruler?.value].filter(Boolean).join(' ');
  if (generic && identity) title = `${identity} coin`;
  if (attribution.status === 'corroborated') title = title.replace(/^(?:provisional(?: identification)?|previously attributed as|attributed to|collector-labelled)\s*[:–—-]?\s*/i, '');
  else if (identity && !/^(?:previously attributed|attributed|possibly|possible|believed|provisional|collector-labelled)\b/i.test(title)) title = `Attributed to ${title}`;
  const base = listingDescriptionText(generated.description).split(HEADING)[0].trim();
  const details = COIN_FACT_KEYS.flatMap(key => {
    const fact = attribution.facts[key];
    if (!fact) return [];
    const source = attribution.agreements.includes(key) ? 'coin and collector note agree' : fact.source === 'visual' ? 'coin photo observation' : fact.source === 'collector' ? 'collector-recorded attribution' : 'recorded attribution, for review';
    return [`${COIN_FACT_LABELS[key]}: ${fact.value} (${source}).`];
  });
  if (!details.length) return { ...generated, title: trimTitle(title) };
  const qualifier = attribution.status === 'corroborated'
    ? 'The country, issue year and denomination are corroborated by matching coin observations and collector notes. This is attribution, not authentication or a metal test.'
    : `Previously attributed as ${identity || 'recorded below'}. The attribution remains provisional where the note has not been corroborated by the coin; collector-recorded composition is not a metal test.`;
  return { ...generated, title: trimTitle(title), description: [base, HEADING, ...details, qualifier, ...attribution.conflicts].filter(Boolean).join('\n\n') };
}
