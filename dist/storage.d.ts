export declare function bytesToHex(bytes: Uint8Array): string;
export interface StorageAdapter {
    get(key: Uint8Array): Uint8Array | undefined;
    set(key: Uint8Array, value: Uint8Array): void;
    getAux?(key: Uint8Array): Uint8Array | undefined;
    setAux?(key: Uint8Array, value: Uint8Array): void;
    entries?(): Array<{
        key: Uint8Array;
        value: Uint8Array;
    }>;
    clear?(): void;
    entriesWithVersion?(): Array<{
        key: Uint8Array;
        value: Uint8Array;
        version: number;
        deleted?: boolean;
        clock?: VectorClock;
    }>;
    setWithVersion?(key: Uint8Array, value: Uint8Array, version: number): void;
    deleteWithVersion?(key: Uint8Array, version: number): void;
    mergeFromRemote?(entries: Array<{
        key: Uint8Array;
        value: Uint8Array;
        version: number;
        deleted?: boolean;
        clock?: VectorClock;
    }>, strategy?: "lww" | "vector"): void;
}
export declare function createInMemoryStorage(): StorageAdapter;
export interface StorageNodeAdapterOptions {
    baseUrl: string;
    did: string;
    collection?: string;
}
export declare class StorageNodeAdapter implements StorageAdapter {
    private cache;
    private auxCache;
    private baseUrl;
    private did;
    private collection;
    constructor(options: StorageNodeAdapterOptions);
    get(key: Uint8Array): Uint8Array | undefined;
    set(key: Uint8Array, value: Uint8Array): void;
    getAux(key: Uint8Array): Uint8Array | undefined;
    setAux(key: Uint8Array, value: Uint8Array): void;
    entries(): {
        key: Uint8Array<ArrayBufferLike>;
        value: Uint8Array<ArrayBufferLike>;
    }[];
    clear(): void;
    pull(key: Uint8Array): Promise<Uint8Array | undefined>;
    listDocuments(collection?: string): Promise<Array<{
        id: string;
        data: any;
    }>>;
    deleteDocument(collection: string, id: string): Promise<boolean>;
    pullAllEntries(collection?: string): Promise<Array<{
        key: Uint8Array;
        value: Uint8Array;
        version: number;
        deleted?: boolean;
        clock?: VectorClock;
    }>>;
    pushEntries(entries: Array<{
        key: Uint8Array;
        value: Uint8Array;
        version: number;
        deleted?: boolean;
        clock?: VectorClock;
    }>, collection?: string): Promise<void>;
    push(key: Uint8Array): Promise<boolean>;
    syncAll(): Promise<void>;
    putDocument(collection: string, id: string, body: Record<string, unknown>): Promise<boolean>;
}
export declare class IndexedDbStorageAdapter implements StorageAdapter {
    private cache;
    private dbName;
    private storeName;
    constructor(dbName?: string, storeName?: string);
    get(key: Uint8Array): Uint8Array | undefined;
    set(key: Uint8Array, value: Uint8Array): void;
    entries(): {
        key: Uint8Array<ArrayBufferLike>;
        value: Uint8Array<ArrayBufferLike>;
    }[];
    entriesWithVersion(): {
        key: Uint8Array<ArrayBufferLike>;
        value: Uint8Array<ArrayBufferLike>;
        version: number;
        deleted: boolean;
        clock: VectorClock | undefined;
    }[];
    setWithVersion(key: Uint8Array, value: Uint8Array, version: number): void;
    deleteWithVersion(key: Uint8Array, version: number): void;
    mergeFromRemote(entries: Array<{
        key: Uint8Array;
        value: Uint8Array;
        version: number;
        deleted?: boolean;
        clock?: VectorClock;
    }>, strategy?: "lww" | "vector"): void;
    clear(): void;
    init(): Promise<void>;
    syncAll(): Promise<void>;
    private openDb;
}
export declare function syncWithStorageNode(local: IndexedDbStorageAdapter, remote: StorageNodeAdapter, collection?: string, strategy?: "lww" | "vector"): Promise<void>;
export declare function hexToBytes(hex: string): Uint8Array;
export type VectorClock = Record<string, number>;
export declare function compareVectorClocks(local: VectorClock, remote: VectorClock): "local" | "remote" | "equal" | "concurrent";
