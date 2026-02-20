/**
 * Persistent Verkle State Manager
 *
 * Wraps a StorageAdapter with a live QuantumVerkleWasm instance that is
 * kept in sync with every storage write. Tracks read/write sets per
 * block execution so verkle witnesses can be generated and included in
 * blocks, enabling stateless validation.
 */
import type { StorageAdapter } from "../storage.js";
import { type QuantumVerkleOptions } from "./quantum_verkle.js";
export interface AccessRecord {
    keyHex: string;
    addressHex: string;
    verkleKeyHex: string;
    valueHex: string | null;
    mode: "read" | "write";
}
export interface VerkleWitness {
    /** Multi-proof covering all accessed keys during block execution */
    proofHex: string;
    /** Keys accessed (read or written) during block execution */
    accessedKeys: Array<{
        keyHex: string;
        valueHex: string | null;
        mode: "read" | "write";
    }>;
    /** State root before block execution */
    preStateRoot: string;
    /** State root after block execution */
    postStateRoot: string;
}
export declare class VerkleStateManager {
    private inner;
    private wasm;
    private tree;
    private currentRoot;
    private accessLog;
    private preBlockRoot;
    private initialized;
    private initPromise;
    private wasmOptions;
    constructor(inner: StorageAdapter, wasmOptions?: QuantumVerkleOptions);
    /** Initialize the WASM module and build the initial tree from existing storage. */
    init(): Promise<void>;
    private _init;
    /** The current verkle state root. */
    get root(): string;
    /**
     * Mark the start of a new block's transaction window.
     * Called automatically when the first pending tx arrives.
     */
    markPreBlockRoot(): void;
    /** Flush accumulated access records and return them + the pre-block root. */
    flushAccessLog(): {
        log: AccessRecord[];
        preRoot: string;
    };
    /** Read from underlying storage + record access. */
    get(key: Uint8Array): Uint8Array | undefined;
    /** Write to underlying storage + update verkle tree + record access. */
    set(key: Uint8Array, value: Uint8Array): void;
    /** Synchronous flush: recompute root from tree (already up-to-date). */
    flushRoot(): Promise<string>;
    /**
     * Generate a VerkleWitness for the block's accessed keys.
     * Must be called after endBlock() and before beginBlock() of the next block.
     */
    generateWitness(accessLog: AccessRecord[], preStateRoot: string): Promise<VerkleWitness>;
    /**
     * Stateless verification: given a witness and block transactions, verify
     * that the state transition is valid without holding full state.
     */
    verifyWitness(witness: VerkleWitness): Promise<boolean>;
    /** Proxy: passthrough to inner storage. */
    getAux(key: Uint8Array): Uint8Array | undefined;
    setAux(key: Uint8Array, value: Uint8Array): void;
    entries(): Array<{
        key: Uint8Array;
        value: Uint8Array;
    }>;
    clear(): void;
    /** Get the underlying storage adapter (for legacy code). */
    get innerStorage(): StorageAdapter;
    /** Build a StorageAdapter-compatible interface from this manager. */
    toStorageAdapter(): StorageAdapter;
}
