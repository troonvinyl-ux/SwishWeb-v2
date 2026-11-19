import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Search, AlertCircle } from 'lucide-react';
const schema=z.object({query:z.string().trim().min(2,'Enter at least two characters.').max(120),mode:z.enum(['text','barcode','catalogue'])});
interface MusicManualSearchProps {busy:boolean;onSearch:(query:string,mode:'text'|'barcode'|'catalogue')=>void;onRelease:(id:number)=>void;}
export default function MusicManualSearch({busy,onSearch,onRelease}:MusicManualSearchProps) {
 const form=useForm<z.infer<typeof schema>>({resolver:zodResolver(schema),defaultValues:{query:'',mode:'text'}});
 const submit=form.handleSubmit(({query,mode})=>{const id=query.match(/^(?:https:\/\/(?:www\.)?discogs\.com\/release\/)?(\d+)(?:-[^/?#]+)?\/?$/)?.[1];if(mode==='text'&&id)onRelease(Number(id));else onSearch(query,mode);});
 return <details className="music-panel"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Manual catalogue search or release ID</summary><form onSubmit={submit} className="mt-4 space-y-3"><div><label htmlFor="music-search-mode">Search by</label><select id="music-search-mode" className="input-field mt-2" disabled={busy} {...form.register('mode')}><option value="text">Artist / title or Discogs release ID</option><option value="barcode">Barcode</option><option value="catalogue">Catalogue number</option></select></div><div><label htmlFor="music-search-query">Search text / individual release ID</label><input id="music-search-query" className="input-field mt-2" disabled={busy} {...form.register('query')}/></div>{form.formState.errors.query&&<p role="alert" className="flex gap-2 text-destructive"><AlertCircle size={20}/>{form.formState.errors.query.message}</p>}<button type="submit" disabled={busy} className="btn-secondary"><Search size={18}/>{busy?'Searching…':'Search Discogs'}</button><p className="text-sm text-muted-foreground">An uncertain or failed match never creates an invented Discogs reference. You can also save a provisional music item.</p></form></details>;
}
