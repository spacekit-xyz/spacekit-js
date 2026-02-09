export class IndexedDbSnapshotProgress {
    dbName;
    storeName;
    db = null;
    constructor(dbName = "spacekit-snapshot-progress", storeName = "progress") {
        this.dbName = dbName;
        this.storeName = storeName;
    }
    async init() {
        if (this.db)
            return;
        this.db = await this.openDb();
    }
    openDb() {
        return new Promise((resolve, reject) => {
            if (typeof indexedDB === "undefined") {
                reject(new Error("IndexedDB not available"));
                return;
            }
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = () => reject(request.error);
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: "snapshotUrl" });
                }
            };
            request.onsuccess = () => resolve(request.result);
        });
    }
    async save(entry) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, "readwrite");
            const store = tx.objectStore(this.storeName);
            store.put(entry);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    async load(snapshotUrl) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const req = store.get(snapshotUrl);
            req.onsuccess = () => resolve(req.result ?? null);
            req.onerror = () => reject(req.error);
        });
    }
}
