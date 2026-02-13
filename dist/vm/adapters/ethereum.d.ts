/**
 * Ethereum proof-bridge adapter. Optional dependency: viem.
 * Submits state roots and bundle hashes to an L1 contract.
 */
import type { ProofBridgeAdapter, ProofBridgeChainConfig } from "../proof_bridge.js";
export declare function createEthereumAdapter(config: ProofBridgeChainConfig): Promise<ProofBridgeAdapter | null>;
