/**
 * IDBDatabase: stores, transactions, createObjectStore.
 */
import type { WalBackend } from "./wal-backend.js";
import { FakeIDBObjectStore } from "./object-store.js";
export interface StoreSchema {
    name: string;
    keyPath: string | string[] | null;
    autoIncrement: boolean;
}
export declare class FakeIDBDatabase {
    readonly name: string;
    readonly version: number;
    private backend;
    private stores;
    constructor(name: string, version: number, backend: WalBackend);
    createObjectStore(name: string, options?: {
        keyPath?: string | string[] | null;
        autoIncrement?: boolean;
    }): FakeIDBObjectStore;
    transaction(storeNames: string | string[], mode: IDBTransactionMode): IDBTransaction;
    get objectStoreNames(): DOMStringList;
    /** For factory: load schema when opening without upgrade. */
    setStoresFromSchema(schema: StoreSchema[]): void;
    /** For factory: persist schema after upgrade. */
    getStoresSchema(): StoreSchema[];
    close(): void;
}
