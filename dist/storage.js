const hexTable = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
export function bytesToHex(bytes) {
    let out = "";
    for (const b of bytes) {
        out += hexTable[b];
    }
    return out;
}
export function createInMemoryStorage() {
    const store = new Map();
    const auxStore = new Map();
    return {
        get(key) {
            return store.get(bytesToHex(key));
        },
        set(key, value) {
            store.set(bytesToHex(key), value);
        },
        getAux(key) {
            return auxStore.get(bytesToHex(key));
        },
        setAux(key, value) {
            auxStore.set(bytesToHex(key), value);
        },
        entries() {
            return Array.from(store.entries()).map(([keyHex, value]) => ({
                key: hexToBytes(keyHex),
                value,
            }));
        },
        clear() {
            store.clear();
            auxStore.clear();
        },
    };
}
export class StorageNodeAdapter {
    cache = new Map();
    auxCache = new Map();
    baseUrl;
    did;
    collection;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/$/, "");
        this.did = options.did;
        this.collection = options.collection ?? "spacekitvm";
    }
    get(key) {
        return this.cache.get(bytesToHex(key));
    }
    set(key, value) {
        this.cache.set(bytesToHex(key), value);
    }
    getAux(key) {
        return this.auxCache.get(bytesToHex(key));
    }
    setAux(key, value) {
        this.auxCache.set(bytesToHex(key), value);
    }
    entries() {
        return Array.from(this.cache.entries()).map(([keyHex, value]) => ({
            key: hexToBytes(keyHex),
            value,
        }));
    }
    clear() {
        this.cache.clear();
        this.auxCache.clear();
    }
    async pull(key) {
        const keyHex = bytesToHex(key);
        const url = `${this.baseUrl}/api/documents/${encodeURIComponent(this.collection)}/${encodeURIComponent(keyHex)}`;
        const res = await fetch(url, {
            headers: {
                Authorization: `DID ${this.did}`,
            },
        });
        if (!res.ok) {
            return undefined;
        }
        const json = await res.json();
        const valueHex = json?.document?.data?.value_hex;
        if (typeof valueHex !== "string") {
            return undefined;
        }
        const value = hexToBytes(valueHex);
        this.cache.set(keyHex, value);
        return value;
    }
    async listDocuments(collection = this.collection) {
        const url = `${this.baseUrl}/api/documents/${encodeURIComponent(collection)}`;
        const res = await fetch(url, {
            headers: {
                Authorization: `DID ${this.did}`,
            },
        });
        if (!res.ok) {
            return [];
        }
        const json = await res.json();
        return Array.isArray(json?.documents) ? json.documents : [];
    }
    async pullAllEntries(collection = this.collection) {
        const docs = await this.listDocuments(collection);
        const entries = [];
        for (const doc of docs) {
            const id = doc?.id;
            const data = doc?.data;
            const valueHex = data?.value_hex;
            const deleted = Boolean(data?.deleted);
            const clock = typeof data?.clock === "object" ? data.clock : undefined;
            if (typeof id !== "string" || typeof valueHex !== "string") {
                if (deleted && typeof id === "string") {
                    entries.push({
                        key: hexToBytes(id),
                        value: new Uint8Array(),
                        version: typeof data?.version === "number" ? data.version : 0,
                        deleted: true,
                        clock,
                    });
                }
                continue;
            }
            const version = typeof data?.version === "number" ? data.version : 0;
            entries.push({
                key: hexToBytes(id),
                value: hexToBytes(valueHex),
                version,
                deleted,
                clock,
            });
        }
        return entries;
    }
    async pushEntries(entries, collection = this.collection) {
        await Promise.all(entries.map((entry) => {
            const keyHex = bytesToHex(entry.key);
            return this.putDocument(collection, keyHex, {
                value_hex: bytesToHex(entry.value),
                version: entry.version,
                deleted: entry.deleted ?? false,
                clock: entry.clock ?? null,
                updated_at: Date.now(),
            });
        }));
    }
    async push(key) {
        const keyHex = bytesToHex(key);
        const value = this.cache.get(keyHex);
        if (!value) {
            return false;
        }
        const url = `${this.baseUrl}/api/documents/${encodeURIComponent(this.collection)}/${encodeURIComponent(keyHex)}`;
        const res = await fetch(url, {
            method: "PUT",
            headers: {
                Authorization: `DID ${this.did}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                value_hex: bytesToHex(value),
                updated_at: Date.now(),
            }),
        });
        return res.ok;
    }
    async syncAll() {
        const keys = Array.from(this.cache.keys());
        await Promise.all(keys.map((key) => this.push(hexToBytes(key))));
    }
    async putDocument(collection, id, body) {
        const url = `${this.baseUrl}/api/documents/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;
        const res = await fetch(url, {
            method: "PUT",
            headers: {
                Authorization: `DID ${this.did}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        return res.ok;
    }
}
export class IndexedDbStorageAdapter {
    cache = new Map();
    dbName;
    storeName;
    constructor(dbName = "spacekitvm", storeName = "kv") {
        this.dbName = dbName;
        this.storeName = storeName;
    }
    get(key) {
        return this.cache.get(bytesToHex(key))?.value;
    }
    set(key, value) {
        this.cache.set(bytesToHex(key), { value, version: Date.now(), deleted: false });
    }
    entries() {
        return Array.from(this.cache.entries()).map(([keyHex, entry]) => ({
            key: hexToBytes(keyHex),
            value: entry.value,
        }));
    }
    entriesWithVersion() {
        return Array.from(this.cache.entries()).map(([keyHex, entry]) => ({
            key: hexToBytes(keyHex),
            value: entry.value,
            version: entry.version,
            deleted: entry.deleted ?? false,
            clock: entry.clock,
        }));
    }
    setWithVersion(key, value, version) {
        this.cache.set(bytesToHex(key), { value, version, deleted: false, clock: { local: 1 } });
    }
    deleteWithVersion(key, version) {
        this.cache.set(bytesToHex(key), { value: new Uint8Array(), version, deleted: true, clock: { local: 1 } });
    }
    mergeFromRemote(entries, strategy = "lww") {
        for (const entry of entries) {
            const keyHex = bytesToHex(entry.key);
            const existing = this.cache.get(keyHex);
            if (strategy === "lww") {
                if (!existing || entry.version >= existing.version) {
                    this.cache.set(keyHex, {
                        value: entry.value,
                        version: entry.version,
                        deleted: entry.deleted ?? false,
                        clock: entry.clock,
                    });
                }
                continue;
            }
            const localClock = existing?.clock ?? {};
            const remoteClock = entry.clock ?? {};
            const comparison = compareVectorClocks(localClock, remoteClock);
            if (comparison === "remote") {
                this.cache.set(keyHex, {
                    value: entry.value,
                    version: entry.version,
                    deleted: entry.deleted ?? false,
                    clock: remoteClock,
                });
            }
            else if (comparison === "concurrent") {
                const conflictKey = `__conflict__:${keyHex}:${Date.now()}`;
                const conflictPayload = JSON.stringify({
                    local: { value_hex: bytesToHex(existing?.value ?? new Uint8Array()), version: existing?.version ?? 0, deleted: existing?.deleted ?? false },
                    remote: { value_hex: bytesToHex(entry.value), version: entry.version, deleted: entry.deleted ?? false },
                });
                this.cache.set(conflictKey, {
                    value: new TextEncoder().encode(conflictPayload),
                    version: Date.now(),
                    deleted: false,
                    clock: { local: 1 },
                });
            }
        }
    }
    clear() {
        this.cache.clear();
    }
    async init() {
        const db = await this.openDb();
        await new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const request = store.openCursor();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const cursor = request.result;
                if (!cursor) {
                    resolve();
                    return;
                }
                const keyHex = cursor.key;
                const raw = cursor.value;
                if (raw instanceof Uint8Array) {
                    this.cache.set(keyHex, { value: new Uint8Array(raw), version: 0, deleted: false, clock: { local: 1 } });
                }
                else {
                    this.cache.set(keyHex, {
                        value: new Uint8Array(raw.value),
                        version: raw.version ?? 0,
                        deleted: raw.deleted ?? false,
                        clock: raw.clock,
                    });
                }
                cursor.continue();
            };
        });
    }
    async syncAll() {
        const db = await this.openDb();
        const entries = Array.from(this.cache.entries());
        await new Promise((resolve, reject) => {
            const tx = db.transaction(this.storeName, "readwrite");
            const store = tx.objectStore(this.storeName);
            for (const [keyHex, entry] of entries) {
                store.put({ value: entry.value, version: entry.version, deleted: entry.deleted ?? false, clock: entry.clock ?? null }, keyHex);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    openDb() {
        return new Promise((resolve, reject) => {
            if (typeof indexedDB === "undefined") {
                reject(new Error("indexedDB is not available in this environment"));
                return;
            }
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = () => resolve(request.result);
        });
    }
}
export async function syncWithStorageNode(local, remote, collection, strategy = "lww") {
    const remoteEntries = await remote.pullAllEntries(collection);
    local.mergeFromRemote(remoteEntries, strategy);
    await local.syncAll();
    const localEntries = local.entriesWithVersion?.() ?? [];
    await remote.pushEntries(localEntries, collection);
}
export function hexToBytes(hex) {
    const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i += 1) {
        out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}
export function compareVectorClocks(local, remote) {
    let localGreater = false;
    let remoteGreater = false;
    const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
    for (const key of keys) {
        const lv = local[key] ?? 0;
        const rv = remote[key] ?? 0;
        if (lv > rv) {
            localGreater = true;
        }
        else if (rv > lv) {
            remoteGreater = true;
        }
    }
    if (localGreater && remoteGreater) {
        return "concurrent";
    }
    if (localGreater) {
        return "local";
    }
    if (remoteGreater) {
        return "remote";
    }
    return "equal";
}
