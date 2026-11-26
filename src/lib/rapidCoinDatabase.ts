import type { RapidCoinJob } from '@/types/rapidCoin';
const DATABASE = 'swish-rapid-coins-v1';
let opening: Promise<IDBDatabase> | undefined;
export function rapidDatabase(): Promise<IDBDatabase> {
  if (!opening) opening = new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('Persistent photo storage is unavailable. Enable IndexedDB in this browser.')); return; }
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => { const jobs = request.result.createObjectStore('jobs', { keyPath: 'id' }); jobs.createIndex('scope', 'scope'); request.result.createObjectStore('photos'); };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); opening = undefined; }; resolve(request.result); };
    request.onerror = () => { opening = undefined; reject(request.error); };
    request.onblocked = () => { opening = undefined; reject(new Error('Close an older SWISH tab to open persistent capture storage.')); };
  });
  return opening;
}
export async function rapidJobs(scope: string): Promise<RapidCoinJob[]> {
  const db = await rapidDatabase();
  return new Promise((resolve, reject) => { const r = db.transaction('jobs').objectStore('jobs').index('scope').getAll(scope); r.onsuccess = () => resolve((r.result as RapidCoinJob[]).sort((a, b) => a.createdAt - b.createdAt)); r.onerror = () => reject(r.error); });
}
export async function rapidJob(id: string): Promise<RapidCoinJob | undefined> {
  const db = await rapidDatabase();
  return new Promise((resolve, reject) => { const r = db.transaction('jobs').objectStore('jobs').get(id); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
/** Await transaction completion before any remote mutation; refused transitions leave the original journal untouched. */
export async function changeRapidJob(id: string, scope: string, update: (job: RapidCoinJob) => RapidCoinJob): Promise<RapidCoinJob> {
  const db = await rapidDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('jobs', 'readwrite'), store = tx.objectStore('jobs'), read = store.get(id); let result: RapidCoinJob, failure: unknown;
    read.onsuccess = () => {
      const current = read.result as RapidCoinJob | undefined;
      if (!current || current.scope !== scope) { failure = new Error('Capture belongs to another seller or is unavailable.'); tx.abort(); return; }
      try { result = { ...update(current), updatedAt: Date.now() }; store.put(result); }
      catch (cause) { failure = cause; tx.abort(); }
    };
    tx.oncomplete = () => { window.dispatchEvent(new Event('swish-rapid-change')); resolve(result); };
    tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error('Capture transaction was not committed.'));
  });
}
export async function createRapidJob(job: RapidCoinJob): Promise<void> {
  const db = await rapidDatabase();
  return new Promise((resolve, reject) => { const tx = db.transaction('jobs', 'readwrite'); tx.objectStore('jobs').add(job); tx.oncomplete = () => { window.dispatchEvent(new Event('swish-rapid-change')); resolve(); }; tx.onerror = tx.onabort = () => reject(tx.error); });
}
export async function retainRapidPhoto(id: string, scope: string, photo: RapidCoinJob['photos'][number], file: File): Promise<void> {
  const db = await rapidDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['jobs', 'photos'], 'readwrite'), jobs = tx.objectStore('jobs'), r = jobs.get(id); let failure: Error | undefined;
    r.onsuccess = () => {
      const job = r.result as RapidCoinJob | undefined;
      if (!job || job.scope !== scope || job.enqueued || job.photos.length >= 12 || job.photos.some(existing => existing.slotId === photo.slotId)) { failure = new Error('Capture or photograph slot changed. Keep this original and retry from the current view.'); tx.abort(); return; }
      tx.objectStore('photos').add(file, `${scope}:${id}:${photo.id}`); jobs.put({ ...job, photos: [...job.photos, photo], updatedAt: Date.now() });
    };
    tx.oncomplete = () => { window.dispatchEvent(new Event('swish-rapid-change')); resolve(); };
    tx.onerror = tx.onabort = () => reject(failure || tx.error || new Error('Photo was not committed. Keep the original and retry.'));
  });
}
export async function rapidPhotoFile(job: RapidCoinJob, photoId: string): Promise<File> {
  const db = await rapidDatabase();
  return new Promise((resolve, reject) => {
    const r = db.transaction('photos').objectStore('photos').get(`${job.scope}:${job.id}:${photoId}`);
    r.onsuccess = () => { const photo = job.photos.find(p => p.id === photoId); if (!r.result || !photo) { reject(new Error('Original photo is unavailable. Do not create another stock item.')); return; } resolve(new File([r.result as Blob], photo.name, { type: photo.type })); };
    r.onerror = () => reject(r.error);
  });
}
