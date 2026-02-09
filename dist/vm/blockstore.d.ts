/**
 * IndexedDB Block Store for SpacekitVm
 *
 * Provides persistent storage for blockchain blocks with:
 * - Block storage by height (primary key)
 * - Block header index for fast queries
 * - Hash-to-height mapping for block lookup by hash
 * - LRU cache for in-memory access
 * - Automatic eviction of old blocks from memory (persisted to IndexedDB)
 */
import type { Block, BlockHeader } from "./spacekitvm.js";
export interface BlockStoreOptions {
    dbName?: string;
    maxBlocksInMemory?: number;
}
export interface BlockStoreStats {
    totalBlocks: number;
    inMemoryBlocks: number;
    persistedBlocks: number;
    latestHeight: number;
    oldestHeight: number;
    dbName: string;
}
/**
 * IndexedDB-backed block store with LRU memory cache.
 *
 * Stores blocks persistently while keeping recent blocks in memory.
 * Automatically evicts old blocks from memory when maxBlocksInMemory is exceeded.
 */
export declare class IndexedDbBlockStore {
    private static readonly DB_VERSION;
    private static readonly CURRENT_SCHEMA_VERSION;
    private dbName;
    private maxBlocksInMemory;
    private db;
    private schemaVersion;
    private memoryBlocks;
    private accessOrder;
    private hashToHeight;
    private latestHeight;
    private oldestPersistedHeight;
    private static readonly BLOCKS_STORE;
    private static readonly HEADERS_STORE;
    private static readonly HASH_INDEX_STORE;
    private static readonly META_STORE;
    constructor(options?: BlockStoreOptions);
    init(): Promise<void>;
    private openDb;
    private loadMeta;
    private migrateSchema;
    private loadRecentBlocks;
    /**
     * Add a new block to the store.
     * Persists to IndexedDB and manages memory cache.
     */
    addBlock(block: Block): Promise<void>;
    private persistBlock;
    private evictFromMemory;
    /**
     * Get a block by height.
     * First checks memory cache, then IndexedDB.
     */
    getBlock(height: number): Promise<Block | null>;
    /**
     * Get a block by its hash.
     */
    getBlockByHash(hash: string): Promise<Block | null>;
    /**
     * Get block header by height (lightweight).
     */
    getHeader(height: number): Promise<BlockHeader | null>;
    /**
     * Get all blocks currently in memory (for fast iteration).
     */
    getBlocksInMemory(): Block[];
    /**
     * Get blocks in a height range.
     */
    getBlockRange(fromHeight: number, toHeight: number): Promise<Block[]>;
    /**
     * Get the latest block.
     */
    getLatestBlock(): Promise<Block | null>;
    /**
     * Get store statistics.
     */
    getStats(): BlockStoreStats;
    /**
     * Get the latest block height.
     */
    getLatestHeight(): number;
    /**
     * Clear all blocks (for testing/reset).
     */
    clear(): Promise<void>;
    /**
     * Close the database connection.
     */
    close(): void;
}
export default IndexedDbBlockStore;
