export type ListingConflictField = 'media_grade' | 'sleeve_grade' | 'play_tested' | 'tracklisting' | 'title' | 'description' | 'condition_description';
export interface ListingConflict { id: string; field: ListingConflictField; question: string; detail: string; options: Array<{ value: string; label: string }>; current: string; }
export interface ListingConflictAnswer { value: string; notes: string; }
