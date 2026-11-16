export interface NumistaReference { typeId: number; numistaN: string; url: string; source: 'seller_reference' | 'backend_match'; }
export interface NumistaVisualCandidate extends NumistaReference { title: string; rank: number; }
export interface NumistaFace { mime_type: 'image/jpeg'; image_data: string; width: number; height: number; label: string; }
