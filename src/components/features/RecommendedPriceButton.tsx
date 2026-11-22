import { Check } from 'lucide-react';
import { recommendedPrice } from '@/lib/recommendedPrice';
export default function RecommendedPriceButton({marketValue,suggestedPrice,onApply}:{marketValue:unknown;suggestedPrice?:unknown;onApply:(value:string)=>void}){
  const saved = Number(suggestedPrice);
  const price = suggestedPrice!==null && suggestedPrice!==undefined && suggestedPrice!=='' && Number.isFinite(saved) && saved>0
    ? Math.round(saved*100)/100 : recommendedPrice(marketValue);
  if(price===null)return null;
  return <button type="button" className="btn-secondary min-h-10 mt-2 text-xs" onClick={()=>onApply(price.toFixed(2))} title={suggestedPrice ? "Use saved SWISH recommendation, without a second discount" : "Use SWISH recommended price, 5% below market value"}><Check className="h-4 w-4"/>Use SWISH £{price.toFixed(2)}</button>;
}
