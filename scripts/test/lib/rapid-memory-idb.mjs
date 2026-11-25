// Deterministic transactional test double. Production uses the browser's IndexedDB, not this adapter.
export function rapidMemoryIdb() {
  const data = { jobs: new Map(), photos: new Map() }, waiting = []; let running = false;
  const clone = value => value === undefined ? undefined : structuredClone(value);
  const pump = () => { if (running || !waiting.length) return; running = true; setTimeout(waiting.shift(), 0); };
  const database = {
    transaction(names, mode = 'readonly') {
      const stores = Array.isArray(names) ? names : [names], requests = []; let started = false, ended = false, working;
      const tx = { error: null, oncomplete: null, onerror: null, onabort: null,
        abort() { if (ended) return; ended = true; tx.error ||= new DOMException('Transaction aborted', 'AbortError'); queueMicrotask(() => { tx.onabort?.(); running = false; pump(); }); },
        objectStore(name) {
          if (!stores.includes(name)) throw Error('Wrong store');
          const request = operation => { const r = { result: undefined, error: null, onsuccess: null, onerror: null }; requests.push(() => { if (ended) return; try { r.result = clone(operation(working[name])); r.onsuccess?.(); } catch (cause) { r.error = cause; tx.error = cause; r.onerror?.(); tx.abort(); } }); if (started) queueMicrotask(step); return r; };
          return { get: key => request(map => map.get(key)),
            add: (value, key = value.id) => request(map => { if (map.has(key)) throw new DOMException('Duplicate key', 'ConstraintError'); map.set(key, clone(value)); return key; }),
            put: (value, key = value.id) => request(map => { map.set(key, clone(value)); return key; }),
            index: name => { if (name !== 'scope') throw Error('Wrong index'); return { getAll: scope => request(map => [...map.values()].filter(row => row.scope === scope)) }; },
          };
        },
      };
      function step() {
        if (ended || !started) return;
        if (requests.length) { requests.shift()(); queueMicrotask(step); return; }
        ended = true;
        if (mode === 'readwrite') for (const name of stores) data[name] = working[name];
        tx.oncomplete?.(); running = false; pump();
      }
      waiting.push(() => { started = true; working = Object.fromEntries(stores.map(name => [name, new Map([...data[name]].map(([key, value]) => [key, clone(value)]))])); queueMicrotask(step); }); pump(); return tx;
    },
    close() {}, onversionchange: null,
  };
  return { data, api: { open() { const r = { result: database, error: null, onsuccess: null, onerror: null, onblocked: null }; setTimeout(() => r.onsuccess?.(), 0); return r; } }, database };
}
