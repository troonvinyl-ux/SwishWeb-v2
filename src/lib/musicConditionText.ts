import type { MusicValues } from '@/types/music';
/** Update only labelled SWISH condition lines; never rewrite unstructured seller claims. */
export function syncMusicConditionText(description: string, values: Pick<MusicValues, 'media_grade' | 'sleeve_grade' | 'play_tested'>): string {
  let next = description.replace(/^Media:\s*[^\r\n]*$/gim, `Media: ${values.media_grade || 'Not graded'}`).replace(/^Sleeve:\s*[^\r\n]*$/gim, `Sleeve: ${values.sleeve_grade || 'Not graded / not applicable'}`);
  const playback = values.play_tested ? 'Playback: Seller reports play-testing; see the seller’s playback/condition notes. This is not a guarantee of defect-free audio.' : 'Not play-tested. Photographs cannot establish sound quality or hidden playback defects.';
  next = next.replace(/^(?:Seller confirms this item has been play-tested\.|Playback: Seller reports play-testing;[^\r\n]*|Not play-tested\. Photographs cannot establish sound quality or hidden playback defects\.)$/gim, playback);
  return next;
}
