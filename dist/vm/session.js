/**
 * Session Persistence for SpacekitVm
 *
 * Stores and recovers:
 * - Contract deployments (WASM bytes + metadata)
 * - Chain state (height, state root)
 * - User nonces
 */
/* ───────────────────────── Helpers ───────────────────────── */
function bytesToBase64(bytes) {
    if (typeof btoa !== "undefined") {
        let binary = "";
        for (const b of bytes) {
            binary += String.fromCharCode(b);
        }
        return btoa(binary);
    }
    return Buffer.from(bytes).toString("base64");
}
function base64ToBytes(base64) {
    if (typeof atob !== "undefined") {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }
    return new Uint8Array(Buffer.from(base64, "base64"));
}
/* ───────────────────────── Session Store ───────────────────────── */
const LEGACY_VERSION = 1;
const CURRENT_VERSION = 2;
export class SessionStore {
    dbName;
    storeName;
    db = null;
    constructor(options = {}) {
        this.dbName = options.dbName ?? "spacekit-session";
        this.storeName = options.storeName ?? "session";
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
                    db.createObjectStore(this.storeName);
                }
            };
            request.onsuccess = () => resolve(request.result);
        });
    }
    /**
     * Save session state
     */
    async saveSession(state) {
        if (!this.db)
            await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, "readwrite");
            const store = tx.objectStore(this.storeName);
            // Store with version for migration support
            store.put({ ...state, version: CURRENT_VERSION }, "current");
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    /**
     * Load session state
     */
    async loadSession() {
        if (!this.db)
            await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, "readonly");
            const store = tx.objectStore(this.storeName);
            const request = store.get("current");
            request.onsuccess = () => {
                const state = request.result;
                if (state) {
                    const version = typeof state.version === "number" ? state.version : LEGACY_VERSION;
                    if (version <= CURRENT_VERSION) {
                        resolve({ ...state, version: CURRENT_VERSION });
                        return;
                    }
                }
                resolve(null);
            };
            request.onerror = () => reject(request.error);
        });
    }
    /**
     * Clear session
     */
    async clearSession() {
        if (!this.db)
            await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(this.storeName, "readwrite");
            const store = tx.objectStore(this.storeName);
            store.delete("current");
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }
    /**
     * Add a contract deployment to the session
     */
    async addContract(contract) {
        const session = await this.loadSession();
        if (session) {
            // Replace existing contract with same ID
            session.contracts = session.contracts.filter(c => c.id !== contract.id);
            session.contracts.push(contract);
            await this.saveSession(session);
        }
    }
    /**
     * Get WASM bytes for a contract
     */
    async getContractWasm(contractId) {
        const session = await this.loadSession();
        if (!session)
            return null;
        const contract = session.contracts.find(c => c.id === contractId);
        if (!contract)
            return null;
        return base64ToBytes(contract.wasmBase64);
    }
    /**
     * Check if a session exists
     */
    async hasSession() {
        const session = await this.loadSession();
        return session !== null && session.contracts.length > 0;
    }
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
/**
 * Create a contract deployment record
 */
export function createContractDeployment(id, name, wasmBytes, wasmHash, abiVersion) {
    return {
        id,
        name,
        wasmHash,
        wasmBase64: bytesToBase64(wasmBytes),
        abiVersion,
        deployedAt: Date.now(),
    };
}
/**
 * Extract WASM bytes from a deployment record
 */
export function getWasmFromDeployment(deployment) {
    return base64ToBytes(deployment.wasmBase64);
}
export default SessionStore;
