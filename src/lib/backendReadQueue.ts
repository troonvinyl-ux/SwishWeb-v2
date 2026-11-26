export type ReadPriority = 'access' | 'foreground' | 'background';
interface ReadJob { rank: number; start: () => void; }
const PRIORITY = { access: 0, foreground: 1, background: 2 };
const queue: ReadJob[] = [];
let active = 0;
function pump() {
  queue.sort((left, right) => left.rank - right.rank);
  while (active < 2 && queue.length) { active += 1; queue.shift()!.start(); }
}
/** READ ONLY: deadlines include queue waits; requests are never automatically replayed. */
export function queueBackendRead<T>(operation: (signal: AbortSignal) => PromiseLike<T>, priority: ReadPriority, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const controller = new AbortController();
    let settled = false, started = false;
    const complete = (error: unknown, value?: T) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      if (started) active -= 1;
      else { const index = queue.indexOf(job); if (index >= 0) queue.splice(index, 1); }
      if (error) reject(error); else resolve(value as T);
      pump();
    };
    const job: ReadJob = { rank: PRIORITY[priority], start: () => {
      started = true;
      void Promise.resolve().then(() => {
        if (settled || controller.signal.aborted) throw new Error('Backend read expired before dispatch.');
        return operation(controller.signal);
      }).then(value => complete(null, value), error => complete(error));
    } };
    const timer = setTimeout(() => {
      controller.abort(); complete(new Error('Backend read timed out. Wait briefly and retry; no authorization decision was returned.'));
    }, timeoutMs);
    queue.push(job); pump();
  });
}
