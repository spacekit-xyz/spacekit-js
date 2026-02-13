/**
 * Proof Bridge: adapter interface and config for pushing SpaceKit proofs
 * to external chains (Ethereum, Bitcoin, Solana). See docs/PROOF_BRIDGE_DESIGN.md.
 */
import type { StateProof, QuantumStateProof, TxProof, ReceiptProof } from "./spacekitvm.js";
import type { RollupBundle, SignedRollupBundle } from "./sequencer.js";
/** Payloads that can be submitted to a chain adapter. */
export type ProofBridgePayload = {
    kind: "state_root";
    blockHeight: number;
    stateRoot: string;
    quantumStateRoot?: string;
} | {
    kind: "state_proof";
    blockHeight: number;
    proof: StateProof;
} | {
    kind: "quantum_state_proof";
    blockHeight: number;
    proof: QuantumStateProof;
} | {
    kind: "bundle";
    bundle: RollupBundle;
} | {
    kind: "signed_bundle";
    signed: SignedRollupBundle;
} | {
    kind: "tx_proof";
    proof: TxProof;
} | {
    kind: "receipt_proof";
    proof: ReceiptProof;
};
/** Result of a single submit. */
export interface ProofBridgeSubmitResult {
    success: boolean;
    id?: string;
    error?: string;
}
/** Adapter that submits proofs to one target chain. */
export interface ProofBridgeAdapter {
    readonly chainId: string;
    isReady(): boolean;
    submit(payload: ProofBridgePayload): Promise<ProofBridgeSubmitResult>;
    start?(): Promise<void>;
    stop?(): Promise<void>;
}
/** Per-chain config (secrets can be env var names). */
export interface ProofBridgeChainConfig {
    enabled: boolean;
    chainId: string;
    rpcUrl?: string;
    contractAddress?: string;
    privateKeyHex?: string;
    gasLimit?: number;
    network?: "mainnet" | "testnet" | "signet";
    commitMethod?: "op_return" | "taproot" | "indexer_api";
    indexerUrl?: string;
    programId?: string;
    keypairPath?: string;
    commitment?: "processed" | "confirmed" | "finalized";
    payloadKinds?: ProofBridgePayload["kind"][];
}
/** Top-level bridge config; can be loaded from URL or inline. */
export interface ProofBridgeConfig {
    source: "inline" | "url";
    configUrl?: string;
    chains?: Record<string, ProofBridgeChainConfig>;
    refreshIntervalMs?: number;
}
/** Resolve env var references in chain config (e.g. privateKeyHex: "SPACEKIT_ETH_SIGNER_KEY"). */
export declare function substituteEnvInChainConfig(chainConfig: ProofBridgeChainConfig): ProofBridgeChainConfig;
/** Load chain configs from ProofBridgeConfig (inline or fetch from configUrl). Returns enabled chains only. */
export declare function loadProofBridgeConfig(config: ProofBridgeConfig): Promise<ProofBridgeChainConfig[]>;
/** Create adapters from loaded chain configs. Requires optional adapter packages or in-repo adapters. */
export declare function createAdaptersFromConfig(chainConfigs: ProofBridgeChainConfig[], options?: {
    adapterRegistry?: AdapterRegistry;
}): Promise<ProofBridgeAdapter[]>;
/** Registry that creates an adapter from chain config. Plug in custom or optional adapters. */
export type AdapterRegistry = {
    create(config: ProofBridgeChainConfig): Promise<ProofBridgeAdapter | null>;
};
/** Set the default adapter registry (used by createAdaptersFromConfig). Used by adapters/index to register Ethereum/Bitcoin/Solana. */
export declare function setDefaultAdapterRegistry(registry: AdapterRegistry): void;
