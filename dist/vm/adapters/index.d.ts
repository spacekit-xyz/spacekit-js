/**
 * Proof-bridge adapters for Ethereum, Bitcoin, and Solana.
 * Registers the default adapter registry so createAdaptersFromConfig works.
 */
/** Register the default Ethereum/Bitcoin/Solana adapter registry. Call once before createAdaptersFromConfig if using adapters. */
export declare function registerDefaultAdapters(): void;
export { createEthereumAdapter } from "./ethereum.js";
export { createBitcoinAdapter } from "./bitcoin.js";
export { createSolanaAdapter } from "./solana.js";
