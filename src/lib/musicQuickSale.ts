import { musicRequest, musicObject } from '@/lib/musicApi';
import { musicInventoryAttributes, musicListingTitle } from '@/lib/musicListing';
import { captureStrings, captureText } from '@/lib/captureRequest';
import { musicContentsEvidence } from '@/lib/listingEvidence';
import type { CaptureScope } from '@/types/capture';
import type { MusicPrice, MusicSnapshot } from '@/types/music';
const money=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)&&value>0?value:null;
const round=(value:number)=>Math.round(value*100)/100;
export function normalizeMusicPrice(raw:Record<string,unknown>,now=new Date().toISOString()):MusicPrice {
 const valuation=musicObject(raw.valuation),sold=musicObject(raw.soldMarket),asking=musicObject(raw.activeAskingPrices),recommendation=musicObject(raw.recommendation);
 if(raw.success!==true)throw new Error('SWISH returned no valuation. Keep or enter your own price.');
 const market=money(valuation.fairMarketValue)??money(valuation.valuationMid),suggested=money(valuation.recommendedListingPrice)??money(recommendation.recommendedPrice);
 if(!market||!suggested)throw new Error('There is not enough evidence for a usable price. No price has been invented.');
 const supported=Number(sold.relevantSoldCount)>0&&Number(sold.verifiedSoldCount)>0&&money(sold.medianPrice)!==null;
 const quick=supported?Math.min(suggested,market*0.925):suggested;
 const basis:MusicPrice['basis']=supported?'sold_supported_estimate':Number(asking.relevantCount)>0?'asking_context_estimate':'ai_only_estimate';
 return {market:round(market),quick:round(quick),minimum:round(quick*0.9),basis,confidence:captureText(valuation.valuationConfidence)||'unknown',explanation:[captureText(valuation.listingPriceRationale??recommendation.reasoning),supported?'Quick-sale adjustment: no more than 92.5% of the supported market estimate.':'The asking-price recommendation is an estimate, not a verified sale.','Optional minimum offer is 90% of the quick-sale price; adjust it for your costs.'].filter(Boolean).join(' '),warnings:captureStrings(valuation.valuationWarnings),researchedAt:now};
}
export function musicQuickSalePrompt(snapshot:MusicSnapshot):string {
 const v=snapshot.values,contents=musicContentsEvidence(snapshot.release?.discCount,v.observed_disc_count,v.format);
 return `You are an experienced UK music and vinyl record reseller. I want to sell this exact release on eBay UK reasonably quickly, rather than wait months for the highest price.
Verified seller-reviewed details: Artist: ${v.artist}; Title: ${v.release_title}; Discogs release ID: ${snapshot.release?.id??'unconfirmed'}; Label: ${v.label}; Catalogue number: ${v.catalogue_number}; Year: ${v.year}; Country: ${v.country}; Format: ${v.format}; Pressing/edition: ${v.edition}; Media condition: ${v.media_grade}; Sleeve condition: ${v.sleeve_grade}; Special characteristics: ${v.features}.
Physical contents: ${contents.disclosure}. Playback: ${v.play_tested?'seller reports testing; review the notes':'not play-tested'}. Faults: ${v.condition_notes}. If contents are incomplete or unknown, do not recommend complete-set value as if the full release were included. State this limitation prominently.
Use only legitimately available market evidence from the existing authorised SWISH integrations. Estimate reasonable UK eBay value, recommend a quick-sale Buy It Now price, briefly explain it, state missing evidence and give a realistic optional Best Offer minimum, all in GBP. Prefer 5–10% below a supported valuation when appropriate; use judgement for rare items. Do not invent completed sales, sold prices, market observations or live listings. Label an AI-only estimate when verified comparisons are unavailable. Photos do not prove playback quality.`;
}
export async function researchMusicPrice(scope:CaptureScope,snapshot:MusicSnapshot,signal?:AbortSignal):Promise<MusicPrice> {
 if(!snapshot.release||!snapshot.values.reviewed)throw new Error('Confirm the individual release and review its details before pricing.');
 const data=await musicRequest(scope,'swish-market-value',{title:musicListingTitle(snapshot.values),specialistId:'vinyl_records',attributes:{...musicInventoryAttributes(snapshot),quick_sale_request:musicQuickSalePrompt(snapshot)},condition:`Media ${snapshot.values.media_grade||'ungraded'}; sleeve ${snapshot.values.sleeve_grade||'ungraded'}. ${snapshot.values.condition_notes}`,applyToItem:false,quickList:true},signal);
 return normalizeMusicPrice(data);
}
