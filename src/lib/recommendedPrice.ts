export function recommendedPrice(marketValue:unknown,discount=0.05):number | null {
  const value=Number(marketValue);if(!Number.isFinite(value)||value<=0||discount<0||discount>0.1)return null;
  return Math.max(0.01,Math.round(value*(1-discount)*100)/100);
}
