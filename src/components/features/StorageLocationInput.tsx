import { useId } from 'react';
import { useCurrentTenantId } from '@/hooks/useCurrentTenantId';
import { useTable } from '@/hooks/useSupabaseQuery';
interface Props {value:string;onChange:(value:string)=>void;className?:string;placeholder?:string;}
export default function StorageLocationInput({value,onChange,className='input-field',placeholder='Box 1, shelf, room…'}:Props){
  const id=useId();const {tenantId}=useCurrentTenantId();
  const {data=[]}=useTable('items',{select:'attributes',filter:{tenant_id:tenantId},enabled:Boolean(tenantId),limit:1000,order:{column:'updated_at',ascending:false}});
  const locations=[...new Set(data.map(row=>{const attrs=row.attributes as Record<string,unknown> | null;return String(attrs?.location || attrs?.storage_location || '').trim();}).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  return <><input aria-label="Storage location" list={id} value={value} onChange={event=>onChange(event.target.value)} className={className} placeholder={placeholder}/><datalist id={id}>{locations.map(location=><option key={location} value={location}/>)}</datalist></>;
}
