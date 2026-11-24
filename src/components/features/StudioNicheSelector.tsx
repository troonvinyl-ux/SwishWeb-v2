import { useId } from 'react';
import { NICHE_DEFAULT_SPECIALIST, type SwishNicheId } from '@/lib/niche';
import { SCAN_PROFILES } from '@/lib/sharedScanFlow';
interface StudioNicheSelectorProps { niche: SwishNicheId | null; allowed: SwishNicheId[]; disabled: boolean; onSelect: (niche: SwishNicheId | null) => void; }
export default function StudioNicheSelector({ niche, allowed, disabled, onSelect }: StudioNicheSelectorProps) {
  const id = useId();
  return <div className="studio-niche-selector"><label htmlFor={id}>Active authorised niche</label><select id={id} value={niche || 'auto'} disabled={disabled} onChange={event => onSelect(event.target.value === 'auto' ? null : event.target.value as SwishNicheId)}><option value="auto">Auto Detect</option>{(Object.keys(NICHE_DEFAULT_SPECIALIST) as SwishNicheId[]).map(value => <option key={value} value={value} disabled={!allowed.includes(value)}>{SCAN_PROFILES[value].name}{allowed.includes(value) ? '' : ' · no access'}</option>)}</select></div>;
}
