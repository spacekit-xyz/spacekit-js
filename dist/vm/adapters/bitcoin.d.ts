/**
 * Bitcoin proof-bridge adapter. Supports indexer API (POST commitment to URL).
 * OP_RETURN / Taproot would require optional bitcoinjs-lib.
 */
import type { ProofBridgeAdapter, ProofBridgeChainConfig } from "../proof_bridge.js";
export declare function createBitcoinAdapter(config: ProofBridgeChainConfig): Promise<ProofBridgeAdapter | null>;
