/** Resize a separate transport copy only. The saved evidence image is never modified. */
export async function studioImageInput(uri: string, signal: AbortSignal): Promise<string> {
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
  const scale = Math.min(1, 1024 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Photo preparation is unavailable in this browser.');
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
