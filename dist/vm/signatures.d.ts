/**
 * Cryptographic Signature Verification for SpacekitVm
 *
 * Supports:
 * - ed25519 (classic, fast)
 * - Dilithium (post-quantum, via external WASM)
 *
 * Uses @noble/ed25519 for ed25519 verification (audited, browser-compatible)
 */
export type SignatureAlgorithm = "ed25519" | "dilithium3" | "dilithium5";
export interface SignedMessage {
    /** The message bytes (or hex string) */
    message: Uint8Array | string;
    /** The signature (base64 or Uint8Array) */
    signature: Uint8Array | string;
    /** The public key (hex or Uint8Array) */
    publicKey: Uint8Array | string;
    /** The algorithm used */
    algorithm: SignatureAlgorithm;
}
export interface TransactionSignature {
    /** Signature bytes (base64 encoded) */
    signatureBase64: string;
    /** Public key used for signing (hex encoded) */
    publicKeyHex: string;
    /** Algorithm used (ed25519 or dilithium) */
    algorithm: SignatureAlgorithm;
}
export interface SignatureVerifier {
    /**
     * Verify a signature
     * @returns true if valid, false otherwise
     */
    verify(params: SignedMessage): Promise<boolean>;
    /**
     * Get supported algorithms
     */
    supportedAlgorithms(): SignatureAlgorithm[];
}
export interface PqSignatureVerifierFunc {
    (messageHex: string, signatureBase64: string, publicKeyHex: string, algorithm?: string): Promise<boolean>;
}
export declare function bytesToHex(bytes: Uint8Array): string;
export declare function hexToBytes(hex: string): Uint8Array;
export declare function base64ToBytes(base64: string): Uint8Array;
export declare function bytesToBase64(bytes: Uint8Array): string;
/**
 * Verify an ed25519 signature
 */
export declare function verifyEd25519(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean>;
/**
 * Sign a message with ed25519 (for testing/dev)
 */
export declare function signEd25519(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>;
/**
 * Generate ed25519 keypair (for testing/dev)
 */
export declare function generateEd25519Keypair(): Promise<{
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}>;
/**
 * Options for creating a signature verifier
 */
export interface SignatureVerifierOptions {
    /** External PQ verifier function (for Dilithium) */
    pqVerifier?: PqSignatureVerifierFunc;
    /** Allow unverified signatures in dev mode */
    devMode?: boolean;
}
/**
 * Create a combined signature verifier supporting both ed25519 and PQ algorithms
 */
export declare function createSignatureVerifier(options?: SignatureVerifierOptions): SignatureVerifier;
/**
 * Create a canonical message for transaction signing
 */
export declare function createTransactionMessage(tx: {
    contractId: string;
    callerDid: string;
    input: Uint8Array;
    value: bigint;
    nonce?: number;
    timestamp?: number;
}): Uint8Array;
/**
 * Hash a transaction message for signing
 */
export declare function hashTransactionMessage(message: Uint8Array): Promise<Uint8Array>;
/**
 * Sign a transaction (for wallet/client use)
 */
export declare function signTransaction(tx: {
    contractId: string;
    callerDid: string;
    input: Uint8Array;
    value: bigint;
    nonce?: number;
    timestamp?: number;
}, privateKey: Uint8Array, algorithm?: SignatureAlgorithm): Promise<TransactionSignature>;
/**
 * Verify a transaction signature
 */
export declare function verifyTransactionSignature(tx: {
    contractId: string;
    callerDid: string;
    input: Uint8Array;
    value: bigint;
    nonce?: number;
    timestamp?: number;
}, signature: TransactionSignature, verifier: SignatureVerifier): Promise<boolean>;
declare const _default: {
    verifyEd25519: typeof verifyEd25519;
    signEd25519: typeof signEd25519;
    generateEd25519Keypair: typeof generateEd25519Keypair;
    createSignatureVerifier: typeof createSignatureVerifier;
    createTransactionMessage: typeof createTransactionMessage;
    hashTransactionMessage: typeof hashTransactionMessage;
    signTransaction: typeof signTransaction;
    verifyTransactionSignature: typeof verifyTransactionSignature;
    bytesToHex: typeof bytesToHex;
    hexToBytes: typeof hexToBytes;
    base64ToBytes: typeof base64ToBytes;
    bytesToBase64: typeof bytesToBase64;
};
export default _default;
