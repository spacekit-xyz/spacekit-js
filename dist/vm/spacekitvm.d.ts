import type { HostOptions, HostContext } from "../host.js";
import type { StorageAdapter } from "../storage.js";
import { type MerkleStep } from "./merkle.js";
import { type QuantumVerkleOptions, type QuantumVerkleProof } from "./quantum_verkle.js";
import { VerkleStateManager } from "./verkle_state.js";
import { type GenesisConfig, type DidDocument, type DidResolver, type SecureBlockHeader } from "./genesis.js";
import { type BlockStoreOptions } from "./blockstore.js";
import { type SignatureAlgorithm } from "./signatures.js";
export interface TransactionSignature {
    /** Signature bytes (base64 encoded) */
    signatureBase64: string;
    /** Public key used for signing (hex encoded) */
    publicKeyHex: string;
    /** Algorithm used (ed25519 or dilithium) */
    algorithm: "ed25519" | "dilithium3" | "dilithium5";
}
export interface Transaction {
    id: string;
    contractId: string;
    callerDid: string;
    input: Uint8Array;
    value: bigint;
    timestamp: number;
    /** Optional nonce for replay protection */
    nonce?: number;
    /** Optional signature for verification */
    signature?: TransactionSignature;
}
export interface Receipt {
    txId: string;
    contractId: string;
    status: number;
    result: Uint8Array;
    events: Array<{
        type: string;
        data: Uint8Array;
    }>;
    timestamp: number;
    gasUsed?: number;
    receiptHash: string;
}
export interface VerkleWitness {
    proofHex: string;
    accessedKeys: Array<{
        keyHex: string;
        valueHex: string | null;
        mode: "read" | "write";
    }>;
    preStateRoot: string;
    postStateRoot: string;
}
export interface Block {
    height: number;
    prevHash: string;
    blockHash: string;
    stateRoot: string;
    quantumStateRoot?: string;
    txRoot: string;
    receiptRoot: string;
    timestamp: number;
    transactions: Transaction[];
    receipts: Receipt[];
    header: BlockHeader;
    /** Verkle witness for stateless validation (present when VerkleStateManager is active) */
    witness?: VerkleWitness;
}
export interface TxProof {
    txId: string;
    txHash: string;
    txRoot: string;
    index: number;
    blockHash: string;
    blockHeight: number;
    proof: MerkleStep[];
}
export interface ReceiptProof {
    txId: string;
    receiptHash: string;
    receiptRoot: string;
    index: number;
    blockHash: string;
    blockHeight: number;
    proof: MerkleStep[];
}
export interface StateProof {
    keyHex: string;
    valueHex: string | null;
    stateRoot: string;
    proofHash: string;
    proof: MerkleStep[];
    verkleProofHex?: string;
    verkleScheme?: string;
}
export interface QuantumStateProof extends QuantumVerkleProof {
    verkleScheme: string;
}
export interface StateSnapshot {
    stateRoot: string;
    quantumStateRoot?: string;
    entries: Array<{
        keyHex: string;
        valueHex: string;
    }>;
    timestamp: number;
}
export interface SealedArchive {
    fromHeight: number;
    toHeight: number;
    blockCount: number;
    sealHash: string;
    timestamp: number;
}
export interface AutoMinerOptions {
    intervalMs: number;
    onlyIfPending?: boolean;
}
export type MeteringCostTable = Record<string, unknown>;
export interface SpacekitVmOptions extends HostOptions {
    storage?: StorageAdapter;
    maxBlocksInMemory?: number;
    chainId?: string;
    /** Max transactions per block (overrides genesis config if provided) */
    maxTxPerBlock?: number;
    feePolicy?: FeePolicy;
    gasPolicy?: GasPolicy;
    treasuryDid?: string;
    pqVerifier?: PqSignatureVerifier;
    requirePqSignature?: boolean;
    /** Genesis configuration for native currency security */
    genesisConfig?: GenesisConfig;
    /** Enable persistent block storage with IndexedDB */
    blockStore?: BlockStoreOptions | boolean;
    /** Require transaction signatures (false = dev mode, true = production) */
    requireSignature?: boolean;
    /** Enable dev mode (skips signature verification, allows unsigned txs) */
    devMode?: boolean;
    /** Enable WASM instruction metering */
    enableWasmMetering?: boolean;
    /** Optional cost table for WASM metering */
    meteringCostTable?: MeteringCostTable;
    /** Enable quantum verkle state roots/proofs */
    quantumVerkle?: QuantumVerkleOptions & {
        enabled?: boolean;
    };
}
export type { GenesisConfig, DidDocument, DidResolver, SecureBlockHeader };
interface DeployedContract {
    id: string;
    wasmHash: string;
    abiVersion: string;
    instance: WebAssembly.Instance;
    context: HostContext;
    setCaller: (did: string) => void;
}
export interface FeePolicy {
    baseFee: bigint;
    perByteFee: bigint;
}
export interface GasPolicy {
    gasPerByte: number;
    gasLimit: number;
}
export type PqSignatureVerifier = (messageHex: string, signatureBase64: string, publicKeyHex: string, algorithm?: string) => Promise<boolean>;
export interface BlockHeader {
    version: string;
    chainId: string;
    height: number;
    timestamp: number;
    prevHash: string;
    blockHash: string;
    txRoot: string;
    receiptRoot: string;
    stateRoot: string;
    quantumStateRoot?: string;
    txCount: number;
    receiptCount: number;
    abiVersion: string;
    gasLimit: number;
    gasUsed: number;
    /** Genesis config hash for audit trail */
    genesisHash?: string;
    /** Current native currency supply */
    totalSupply?: string;
    /** Supply cap from genesis */
    supplyCap?: string;
}
export declare class SpacekitVm {
    private contracts;
    private pending;
    private blocks;
    private sealed;
    private totalHeight;
    private maxBlocksInMemory;
    private hostOptions;
    private txIndex;
    private receiptIndex;
    private nonceByDid;
    private chainId;
    private feePolicy;
    private gasPolicy;
    private treasuryDid;
    private pqVerifier?;
    private requirePqSignature;
    private autoMinerTimer?;
    private autoMining;
    private maxTxPerBlock;
    private genesisConfig;
    private genesisHash;
    private didResolver;
    private currentSupply;
    private blockStore;
    private blockStoreReady;
    private signatureVerifier;
    private requireSignature;
    private devMode;
    private enableWasmMetering;
    private meteringCostTable?;
    private internalCallDepth;
    private readonly maxInternalCallDepth;
    private quantumVerkle?;
    private quantumVerkleOptions?;
    private verkleState;
    constructor(options?: SpacekitVmOptions);
    initQuantumVerkle(): Promise<void>;
    /**
     * Set or update the LLM adapter at runtime.
     * Allows adding LLM support to an existing VM without re-initializing.
     */
    setLlmAdapter(adapter: import("../host.js").LlmAdapter): void;
    /**
     * Get the current LLM adapter (if any).
     */
    getLlmAdapter(): import("../host.js").LlmAdapter | undefined;
    /**
     * Initialize block store (must be called before mining if blockStore is enabled).
     * Returns the latest block height from persistent storage.
     */
    initBlockStore(): Promise<number>;
    /**
     * Check if block store is enabled and ready.
     */
    isBlockStoreReady(): boolean;
    /**
     * Get block store statistics.
     */
    getBlockStoreStats(): {
        totalBlocks: number;
        inMemoryBlocks: number;
        persistedBlocks: number;
        latestHeight: number;
    } | null;
    /**
     * Initialize genesis state: seed treasury and register initial DIDs.
     */
    private initializeGenesis;
    /**
     * Get the genesis configuration hash.
     */
    getGenesisHash(): string;
    /**
     * Get the genesis configuration.
     */
    getGenesisConfig(): GenesisConfig;
    /**
     * Get the DID resolver instance.
     */
    getDidResolver(): DidResolver | null;
    /**
     * Resolve a DID to its document (public key, algorithm, etc.).
     */
    resolveDid(did: string): Promise<DidDocument | null>;
    /**
     * Register a new DID with its public key.
     */
    registerDid(did: string, publicKeyHex: string, algorithm?: string): Promise<boolean>;
    /**
     * Get the current total supply of native currency.
     */
    getCurrentSupply(): bigint;
    /**
     * Get the maximum supply cap from genesis.
     */
    getMaxSupply(): bigint;
    getChainId(): string;
    /**
     * Check if a storage key is protected from contract modification.
     */
    isKeyProtected(key: string): boolean;
    private ensureVerkleState;
    deployContract(wasm: ArrayBuffer | Uint8Array | Response, contractId?: string): Promise<DeployedContract>;
    private callContractInternal;
    getContract(contractId: string): DeployedContract;
    executeTransaction(contractId: string, input: Uint8Array, callerDid: string, value?: bigint, txId?: string): Promise<Receipt>;
    submitTransaction(contractId: string, input: Uint8Array, callerDid: string, value?: bigint, signature?: TransactionSignature): Promise<Transaction>;
    /**
     * Check if signature verification is required
     */
    isSignatureRequired(): boolean;
    /**
     * Check if running in dev mode
     */
    isDevMode(): boolean;
    /**
     * Get supported signature algorithms
     */
    getSupportedAlgorithms(): SignatureAlgorithm[];
    mineBlock(): Promise<Block | null>;
    startAutoMiner(options: AutoMinerOptions): () => void;
    stopAutoMiner(): void;
    sealBlocks(): Promise<SealedArchive | null>;
    getBlocks(): Block[];
    /**
     * Import blocks into the VM block store or memory.
     * Note: This does NOT apply state transitions; use snapshots or replay for state.
     */
    importBlocks(blocks: Block[], options?: {
        storeOnly?: boolean;
    }): Promise<number>;
    /**
     * Get a block by height (async for block store access).
     */
    getBlockByHeight(height: number): Promise<Block | null>;
    /**
     * Get a block by hash (async for block store access).
     */
    getBlockByHash(hash: string): Promise<Block | null>;
    getSealedArchives(): SealedArchive[];
    getBlockHeader(height: number): BlockHeader | null;
    /**
     * Get block header by height (async for block store access).
     */
    getBlockHeaderAsync(height: number): Promise<BlockHeader | null>;
    estimateFee(bytes: number): bigint;
    getFeePolicy(): FeePolicy;
    estimateGas(bytes: number): number;
    getGasPolicy(): GasPolicy;
    isPqSignatureRequired(): boolean;
    verifyPqSignature(messageHex: string, signatureBase64: string, publicKeyHex: string, algorithm?: string): Promise<boolean>;
    private chargeFeeOrThrow;
    private transferValueOrThrow;
    getStorageValue(keyHex: string): Uint8Array | null;
    setStorageValueWithAux(keyHex: string, valueHex: string, auxHex?: string): void;
    getNonce(did: string): number;
    bumpNonce(did: string): number;
    getTransaction(txId: string): Transaction | undefined;
    getReceipt(txId: string): Receipt | undefined;
    getStateProof(keyHex: string): Promise<StateProof>;
    getQuantumStateProof(keyHex: string): Promise<QuantumStateProof>;
    getTxProof(txId: string): Promise<TxProof | null>;
    getReceiptProof(txId: string): Promise<ReceiptProof | null>;
    createSnapshot(): Promise<StateSnapshot>;
    restoreSnapshot(snapshot: StateSnapshot): void;
    applySnapshotDelta(entries: Array<{
        keyHex: string;
        valueHex: string;
    }>): void;
    computeStateRoot(): Promise<string>;
    computeQuantumStateRoot(): Promise<string>;
    /** Get the VerkleStateManager (if stateless mode is active). */
    getVerkleStateManager(): VerkleStateManager | null;
    /**
     * Verify a block statelessly using only the block header, transactions, and witness.
     * Does not require holding any persistent state — suitable for light clients.
     */
    verifyBlockStateless(block: Block): Promise<{
        valid: boolean;
        reason?: string;
    }>;
    private computeStateProof;
}
