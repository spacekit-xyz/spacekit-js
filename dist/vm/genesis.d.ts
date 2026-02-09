/**
 * Genesis Configuration and Native Currency Security
 *
 * This module provides cryptographic security for the native ASTRA currency:
 * 1. Genesis block commitment with immutable currency config
 * 2. Protected storage prefixes (contracts cannot modify native balances)
 * 3. Supply cap enforcement
 * 4. DID resolution for identity verification
 */
export interface NativeCurrencyConfig {
    /** Currency symbol (e.g., "ASTRA") */
    symbol: string;
    /** Currency name (e.g., "ASTRA Native Token") */
    name: string;
    /** Decimal places (typically 18) */
    decimals: number;
    /** Maximum supply cap (0 = unlimited) */
    maxSupply: bigint;
    /** Initial treasury allocation */
    initialTreasurySupply: bigint;
    /** Whether minting is allowed after genesis */
    mintable: boolean;
}
export interface GenesisConfig {
    /** Chain identifier */
    chainId: string;
    /** Genesis timestamp */
    timestamp: number;
    /** Max transactions allowed per block (null = unlimited) */
    maxTxPerBlock?: number | null;
    /** Native currency configuration */
    nativeCurrency: NativeCurrencyConfig;
    /** Treasury DID that receives fees */
    treasuryDid: string;
    /** Initial DID registrations */
    initialDids: DidRegistration[];
    /** Genesis block version */
    version: string;
}
export declare const DEFAULT_GENESIS_CONFIG: GenesisConfig;
/**
 * Get canonical string representation of genesis config for hashing.
 */
export declare function getGenesisCanonical(config: GenesisConfig): string;
/**
 * Compute the cryptographic hash of the genesis configuration (async).
 * This hash is stored in every block header for audit.
 */
export declare function computeGenesisHash(config: GenesisConfig): Promise<string>;
/**
 * Compute genesis hash synchronously using a simple hash function.
 * Used for initialization before async context is available.
 */
export declare function computeGenesisHashSync(config: GenesisConfig): string;
/**
 * Storage key prefixes that contracts are NOT allowed to modify.
 * Only the VM/protocol layer can write to these.
 */
export declare const PROTECTED_PREFIXES: readonly ["native:", "did:document:", "genesis:", "validator:", "governance:"];
/**
 * Check if a storage key is protected from contract modification.
 */
export declare function isProtectedKey(key: string): boolean;
/**
 * Validate that a contract is not trying to write to protected storage.
 * @throws Error if the key is protected
 */
export declare function enforceStorageProtection(key: string, contractId: string): void;
export interface SupplyState {
    currentSupply: bigint;
    maxSupply: bigint;
    mintable: boolean;
}
/**
 * Validate a mint operation against the supply cap.
 * @throws Error if minting would exceed the cap or is not allowed
 */
export declare function validateMint(amount: bigint, state: SupplyState): void;
export interface DidDocument {
    /** The DID being described */
    id: string;
    /** Public key for signature verification (hex encoded) */
    publicKeyHex: string;
    /** Cryptographic algorithm (e.g., "ed25519", "sphincs-shake-256f") */
    algorithm: string;
    /** Controller DID (for delegated control) */
    controller?: string;
    /** Timestamp when registered */
    created: number;
    /** Last update timestamp */
    updated: number;
    /** Whether this DID is active */
    active: boolean;
}
export interface DidRegistration {
    did: string;
    publicKeyHex: string;
    algorithm: string;
}
/**
 * Storage key for a DID document.
 */
export declare function didDocumentKey(did: string): string;
/**
 * Create a new DID document.
 */
export declare function createDidDocument(did: string, publicKeyHex: string, algorithm: string, controller?: string): DidDocument;
/**
 * Serialize a DID document for storage.
 */
export declare function serializeDidDocument(doc: DidDocument): Uint8Array;
/**
 * Deserialize a DID document from storage.
 */
export declare function deserializeDidDocument(data: Uint8Array): DidDocument | null;
export interface DidResolver {
    resolve(did: string): Promise<DidDocument | null>;
    register(doc: DidDocument, signature?: string): Promise<boolean>;
    update(did: string, updates: Partial<DidDocument>, signature: string): Promise<boolean>;
    deactivate(did: string, signature: string): Promise<boolean>;
}
/**
 * Create a DID resolver backed by storage.
 */
export declare function createDidResolver(storage: {
    get(key: Uint8Array): Uint8Array | undefined;
    set(key: Uint8Array, value: Uint8Array): void;
}): DidResolver;
export interface SecureBlockHeader {
    /** Hash of the genesis configuration (for audit) */
    genesisHash: string;
    /** Current total native currency supply */
    totalSupply: string;
    /** Supply cap from genesis config */
    supplyCap: string;
}
/**
 * Create secure block header extension data.
 */
export declare function createSecureHeaderData(genesisHash: string, totalSupply: bigint, supplyCap: bigint): SecureBlockHeader;
