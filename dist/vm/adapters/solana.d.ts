/**
 * Solana proof-bridge adapter. Optional dependency: @solana/web3.js.
 * Submits state root / bundle hash to a program account or instruction.
 */
import type { ProofBridgeAdapter, ProofBridgeChainConfig } from "../proof_bridge.js";
export declare function createSolanaAdapter(config: ProofBridgeChainConfig): Promise<ProofBridgeAdapter | null>;
