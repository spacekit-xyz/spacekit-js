/**
 * Proof Bridge Service: out-of-process daemon that loads bridge config,
 * creates adapters (Ethereum, Bitcoin, Solana), and polls a SpaceKit storage
 * node or RPC for new bundles/state roots and submits them to each chain.
 *
 * Env:
 *   PROOF_BRIDGE_CONFIG_URL  - fetch config JSON from this URL
 *   PROOF_BRIDGE_CONFIG_PATH - or path to local config JSON file
 *   PROOF_BRIDGE_SOURCE      - "storage" | "rpc" (default: storage)
 *   POLL_INTERVAL_MS         - poll interval (default: 30000)
 *   For storage source:
 *     SPACEKIT_STORAGE_BASE_URL, SPACEKIT_STORAGE_DID,
 *     SPACEKIT_ROLLUP_COLLECTION (default: spacekitvm_rollups)
 *   For rpc source:
 *     SPACEKIT_RPC_URL
 *
 * Run after build: node dist/scripts/proof_bridge_service.js
 * Or: npm run proof-bridge-service
 */
import "../vm/adapters/index.js";
