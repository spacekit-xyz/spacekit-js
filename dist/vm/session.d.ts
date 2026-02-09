/**
 * Session Persistence for SpacekitVm
 *
 * Stores and recovers:
 * - Contract deployments (WASM bytes + metadata)
 * - Chain state (height, state root)
 * - User nonces
 */
export interface ContractDeployment {
    id: string;
    name: string;
    wasmHash: string;
    /** WASM bytes stored as base64 */
    wasmBase64: string;
    abiVersion: string;
    deployedAt: number;
}
export interface SessionState {
    /** Chain ID */
    chainId: string;
    /** Active identity DID (optional) */
    identityDid?: string;
    /** Latest block height */
    latestHeight: number;
    /** Latest block hash */
    latestBlockHash: string;
    /** State root from latest block */
    stateRoot: string;
    /** Quantum Verkle state root from latest block (optional) */
    quantumStateRoot?: string;
    /** Deployed contracts */
    contracts: ContractDeployment[];
    /** Nonces by DID */
    nonces: Record<string, number>;
    /** Session timestamp */
    timestamp: number;
    /** Session version for migration */
    version: number;
}
export interface SessionStoreOptions {
    dbName?: string;
    storeName?: string;
}
export declare class SessionStore {
    private dbName;
    private storeName;
    private db;
    constructor(options?: SessionStoreOptions);
    init(): Promise<void>;
    private openDb;
    /**
     * Save session state
     */
    saveSession(state: SessionState): Promise<void>;
    /**
     * Load session state
     */
    loadSession(): Promise<SessionState | null>;
    /**
     * Clear session
     */
    clearSession(): Promise<void>;
    /**
     * Add a contract deployment to the session
     */
    addContract(contract: ContractDeployment): Promise<void>;
    /**
     * Get WASM bytes for a contract
     */
    getContractWasm(contractId: string): Promise<Uint8Array | null>;
    /**
     * Check if a session exists
     */
    hasSession(): Promise<boolean>;
    close(): void;
}
/**
 * Create a contract deployment record
 */
export declare function createContractDeployment(id: string, name: string, wasmBytes: Uint8Array, wasmHash: string, abiVersion: string): ContractDeployment;
/**
 * Extract WASM bytes from a deployment record
 */
export declare function getWasmFromDeployment(deployment: ContractDeployment): Uint8Array;
export default SessionStore;
