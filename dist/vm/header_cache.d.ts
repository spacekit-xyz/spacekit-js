export interface HeaderCacheEntry<T = unknown> {
    rpcUrl: string;
    chainId?: string;
    latestHeight: number;
    syncedAt: number;
    headers: T[];
}
export declare class IndexedDbHeaderCache<T = unknown> {
    private dbName;
    private storeName;
    private db;
    constructor(dbName?: string, storeName?: string);
    init(): Promise<void>;
    private openDb;
    save(entry: HeaderCacheEntry<T>): Promise<void>;
    load(rpcUrl: string): Promise<HeaderCacheEntry<T> | null>;
}
