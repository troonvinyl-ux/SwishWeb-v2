import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import type { ReactNode } from 'react';
interface StudioToolSheetProps { children: ReactNode; disabled: boolean; }
export default function StudioToolSheet({ children, disabled }: StudioToolSheetProps) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className="studio-tools-button" disabled={disabled} aria-expanded={open} onClick={() => setOpen(value => !value)}><SlidersHorizontal size={18} />Tools / Ask SWISH</button>{open && <section className="studio-tool-sheet" aria-label="Camera and research tools"><header><h2>Tools / Ask SWISH</h2><button type="button" className="studio-icon" aria-label="Close tools" onClick={() => setOpen(false)}><X size={20} /></button></header>{children}</section>}</>;
}
