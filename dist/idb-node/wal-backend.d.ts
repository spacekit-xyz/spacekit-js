/**
 * Pure TypeScript storage backend: sorted in-memory store + append-only WAL.
 * Replay WAL on open; compaction rewrites WAL to a snapshot.
 * Node/Bun only (uses node:fs).
 */
export interface ScanRange {
    lower?: IDBValidKey;
    upper?: IDBValidKey;
    lowerOpen?: boolean;
    upperOpen?: boolean;
}
export declare class WalBackend {
    /** store name -> sorted array of [encodedKeyHex, valueJson] */
    private data;
    private walPath;
    constructor(dbPath: string);
    private replay;
    private applyEntry;
    private binarySearch;
    private keyToHex;
    put(store: string, key: IDBValidKey, value: unknown): void;
    get(store: string, key: IDBValidKey): unknown | undefined;
    delete(store: string, key: IDBValidKey): void;
    clear(store: string): void;
    /**
     * Scan a store within an optional range, for cursors and key ranges.
     */
    scan(store: string, range: ScanRange, direction?: "next" | "prev"): Array<{
        key: IDBValidKey;
        value: unknown;
    }>;
    listStores(): string[];
    /**
     * Compact WAL: rewrite as a single snapshot and truncate.
     */
    compact(): void;
}
