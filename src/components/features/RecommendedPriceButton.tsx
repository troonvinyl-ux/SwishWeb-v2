import { Check } from 'lucide-react';
import { recommendedPrice } from '@/lib/recommendedPrice';
export default function RecommendedPriceButton({marketValue,onApply}:{marketValue:unknown;onApply:(value:string)=>void}){
  const price=recommendedPrice(marketValue);if(price===null)return null;
  return <button type="button" className="btn-secondary min-h-10 mt-2 text-xs" onClick={()=>onApply(price.toFixed(2))} title="Use SWISH recommended price, 5% below market value"><Check className="h-4 w-4"/>Use SWISH £{price.toFixed(2)}</button>;
}
