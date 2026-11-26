import { asRecord } from '@/lib/itemPhotos';
import { itemPricing, positiveMoney, savedMarketData } from '@/lib/itemPricing';
export interface RapidCoinPrices { market: number | null; quick: number | null; recommended: number | null; low: number | null; high: number | null; quality: string; soldMedian: number | null; askingMedian: number | null; }
/** Quick Sale uses the existing engine's ratio, never an AI-confidence discount or an invented default. */
export function rapidCoinPrices(item: Record<string, unknown> | null): RapidCoinPrices {
  const data = savedMarketData(item), pricing = itemPricing(item, null, data), recommendation = asRecord(data.recommendation), sold = asRecord(data.soldMarket), asking = asRecord(data.activeAskingPrices);
  const ratio = Number(recommendation.quickSaleRatio);
  const quick = pricing.market !== null && Number.isFinite(ratio) && ratio > 0 && ratio <= 1 ? Math.round(pricing.market * ratio * 100) / 100 : null;
  return { market: pricing.market, recommended: pricing.suggested, quick: positiveMoney(quick), low: pricing.low, high: pricing.high,
    quality: String(sold.dataQualityReason || 'Evidence quality not established'),
    soldMedian: Number(sold.verifiedSoldCount) > 0 ? positiveMoney(sold.medianPrice) : null, askingMedian: positiveMoney(asking.medianAskingPrice) };
}
