/** Resize a separate transport copy only. The saved evidence image is never modified. */
export async function studioImageInput(uri: string, signal: AbortSignal, maximum = 1024): Promise<string> {
  const response = await fetch(uri, { signal });
  if (!response.ok) throw new Error('The original photo could not be downloaded. It remains unchanged.');
  const blob = await response.blob();
  if (blob.size > 25_000_000) throw new Error('The original photo is too large to prepare in this browser.');
  const objectUrl = URL.createObjectURL(blob);
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const source = new Image();
    source.onload = () => { URL.revokeObjectURL(objectUrl); resolve(source); };
    source.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not decode the original photo.')); };
    source.src = objectUrl;
  });
  if (signal.aborted) throw new Error('Photo preparation cancelled. Original retained.');
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('Original image dimensions are unavailable.');
  const scale = Math.min(1, maximum / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo preparation is unavailable in this browser.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const copy = canvas.toDataURL('image/jpeg', maximum === 1600 ? 0.95 : 0.85);
  if (copy.length > 4_000_000) throw new Error('The photographic processing copy exceeds the safe limit. Original retained.');
  return copy;
}
