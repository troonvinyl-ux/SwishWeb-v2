import { useEffect, useRef } from 'react';
export function useCameraDialog(open: boolean, close: () => void) {
  const ref=useRef<HTMLDivElement>(null);
  useEffect(() => { if(!open) return; const previous=document.activeElement as HTMLElement | null; const overflow=document.body.style.overflow; document.body.style.overflow='hidden';
    const elements=() => Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') || []).filter(element => element.getClientRects().length > 0 && !element.closest('[hidden]'));
    elements()[0]?.focus(); const key=(event:KeyboardEvent) => {if(event.key==='Escape'){event.preventDefault();close();} if(event.key==='Tab'){const list=elements(), first=list[0],last=list[list.length-1]; if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}}};
    document.addEventListener('keydown',key); return () => {document.body.style.overflow=overflow;document.removeEventListener('keydown',key);previous?.focus();};
  },[open,close]);return ref;
}
