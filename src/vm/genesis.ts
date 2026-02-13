/**
 * Genesis Configuration and Native Currency Security
 * 
 * This module provides cryptographic security for the native ASTRA currency:
 * 1. Genesis block commitment with immutable currency config
 * 2. Protected storage prefixes (contracts cannot modify native balances)
 * 3. Supply cap enforcement
 * 4. DID resolution for identity verification
 */

import { sha256Hex, hashString } from "./hash.js";
import { verifyEd25519, hexToBytes, base64ToBytes } from "./signatures.js";

/* ───────────────────────── Currency Config ───────────────────────── */

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

export const DEFAULT_GENESIS_CONFIG: GenesisConfig = {
  chainId: "spacekitvm-local",
  timestamp: Date.now(),
  version: "1.0.0",
  maxTxPerBlock: null,
  nativeCurrency: {
    symbol: "ASTRA",
    name: "ASTRA Native Token",
    decimals: 18,
    maxSupply: 1_000_000_000_000n, // 1 trillion max supply
    initialTreasurySupply: 100_000_000_000n, // 100 billion to treasury
    mintable: false, // No minting after genesis
  },
  treasuryDid: "did:spacekit:treasury",
  initialDids: [],
};

/**
 * Decimal places and symbols for common networks so the VM can match L1 conventions
 * when the browser-VM is "programmed for" a given chain (e.g. display, fees, ERC-20 decimals).
 * Used by getGenesisPresetForNetwork() and compatible with proof-bridge target chains.
 */
export const NETWORK_DECIMAL_PRESETS: Record<
  string,
  { decimals: number; symbol: string; name: string }
> = {
  bitcoin: { decimals: 8, symbol: "BTC", name: "Bitcoin" },
  btc: { decimals: 8, symbol: "BTC", name: "Bitcoin" },
  ethereum: { decimals: 18, symbol: "ETH", name: "Ethereum" },
  eth: { decimals: 18, symbol: "ETH", name: "Ethereum" },
  solana: { decimals: 9, symbol: "SOL", name: "Solana" },
  sol: { decimals: 9, symbol: "SOL", name: "Solana" },
  astra: { decimals: 18, symbol: "ASTRA", name: "ASTRA Native Token" },
  "spacekitvm-local": { decimals: 18, symbol: "ASTRA", name: "ASTRA Native Token" },
  "spacekit-local": { decimals: 18, symbol: "ASTRA", name: "ASTRA Native Token" },
};

/**
 * Return a genesis config that uses the same decimal system (and symbol) as the given network.
 * Use when the VM should behave like a given chain (BTC=8, ETH/SOL/ASTRA=18/9/18). Returns null
 * for unknown networks so the caller can fall back to DEFAULT_GENESIS_CONFIG.
 */
export function getGenesisPresetForNetwork(network: string): GenesisConfig | null {
  const key = network.toLowerCase().replace(/^spacekit-/, "");
  const preset = NETWORK_DECIMAL_PRESETS[key] ?? NETWORK_DECIMAL_PRESETS[network.toLowerCase()];
  if (!preset) return null;
  return {
    ...DEFAULT_GENESIS_CONFIG,
    chainId: network,
    timestamp: Date.now(),
    nativeCurrency: {
      ...DEFAULT_GENESIS_CONFIG.nativeCurrency,
      decimals: preset.decimals,
      symbol: preset.symbol,
      name: preset.name,
    },
  };
}

/**
 * Get canonical string representation of genesis config for hashing.
 */
export function getGenesisCanonical(config: GenesisConfig): string {
  return JSON.stringify({
    chainId: config.chainId,
    timestamp: config.timestamp,
    version: config.version,
    maxTxPerBlock: config.maxTxPerBlock ?? null,
    nativeCurrency: {
      symbol: config.nativeCurrency.symbol,
      name: config.nativeCurrency.name,
      decimals: config.nativeCurrency.decimals,
      maxSupply: config.nativeCurrency.maxSupply.toString(),
      initialTreasurySupply: config.nativeCurrency.initialTreasurySupply.toString(),
      mintable: config.nativeCurrency.mintable,
    },
    treasuryDid: config.treasuryDid,
    initialDids: config.initialDids.map(d => ({
      did: d.did,
      publicKeyHex: d.publicKeyHex,
      algorithm: d.algorithm,
    })),
  });
}

/**
 * Compute the cryptographic hash of the genesis configuration (async).
 * This hash is stored in every block header for audit.
 */
export async function computeGenesisHash(config: GenesisConfig): Promise<string> {
  const canonical = getGenesisCanonical(config);
  return sha256Hex(hashString(canonical));
}

/**
 * Compute genesis hash synchronously using a simple hash function.
 * Used for initialization before async context is available.
 */
export function computeGenesisHashSync(config: GenesisConfig): string {
  const canonical = getGenesisCanonical(config);
  // Simple sync hash for initialization (not cryptographically strong but sufficient for demo)
  let hash = 0;
  for (let i = 0; i < canonical.length; i++) {
    const char = canonical.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `genesis_${Math.abs(hash).toString(16).padStart(16, '0')}`;
}

/* ───────────────────────── Protected Storage ───────────────────────── */

/**
 * Storage key prefixes that contracts are NOT allowed to modify.
 * Only the VM/protocol layer can write to these.
 */
export const PROTECTED_PREFIXES = [
  "native:",        // Native currency balances
  "did:document:",  // DID documents
  "genesis:",       // Genesis configuration
  "validator:",     // Validator registry
  "governance:",    // Governance state
] as const;

/**
 * Check if a storage key is protected from contract modification.
 */
export function isProtectedKey(key: string): boolean {
  return PROTECTED_PREFIXES.some(prefix => key.startsWith(prefix));
}

/**
 * Validate that a contract is not trying to write to protected storage.
 * @throws Error if the key is protected
 */
export function enforceStorageProtection(key: string, contractId: string): void {
  if (isProtectedKey(key)) {
    throw new Error(
      `Contract ${contractId} cannot modify protected storage key: ${key}. ` +
      `Protected prefixes: ${PROTECTED_PREFIXES.join(", ")}`
    );
  }
}

/* ───────────────────────── Supply Cap Enforcement ───────────────────────── */

export interface SupplyState {
  currentSupply: bigint;
  maxSupply: bigint;
  mintable: boolean;
}

/**
 * Validate a mint operation against the supply cap.
 * @throws Error if minting would exceed the cap or is not allowed
 */
export function validateMint(
  amount: bigint,
  state: SupplyState
): void {
  if (!state.mintable) {
    throw new Error("Native currency minting is disabled after genesis");
  }
  if (state.maxSupply > 0n) {
    const newSupply = state.currentSupply + amount;
    if (newSupply > state.maxSupply) {
      throw new Error(
        `Mint would exceed supply cap: ${newSupply} > ${state.maxSupply}`
      );
    }
  }
}

/* ───────────────────────── DID Resolution ───────────────────────── */

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
export function didDocumentKey(did: string): string {
  return `did:document:${did}`;
}

/**
 * Create a new DID document.
 */
export function createDidDocument(
  did: string,
  publicKeyHex: string,
  algorithm: string,
  controller?: string
): DidDocument {
  const now = Date.now();
  return {
    id: did,
    publicKeyHex,
    algorithm,
    controller,
    created: now,
    updated: now,
    active: true,
  };
}

/**
 * Serialize a DID document for storage.
 */
export function serializeDidDocument(doc: DidDocument): Uint8Array {
  const json = JSON.stringify(doc);
  return new TextEncoder().encode(json);
}

/**
 * Deserialize a DID document from storage.
 */
export function deserializeDidDocument(data: Uint8Array): DidDocument | null {
  try {
    const json = new TextDecoder().decode(data);
    return JSON.parse(json) as DidDocument;
  } catch {
    return null;
  }
}

/* ───────────────────────── DID Resolver ───────────────────────── */

export interface DidResolver {
  resolve(did: string): Promise<DidDocument | null>;
  register(doc: DidDocument, signature?: string): Promise<boolean>;
  update(did: string, updates: Partial<DidDocument>, signature: string): Promise<boolean>;
  deactivate(did: string, signature: string): Promise<boolean>;
}

/**
 * Create a DID resolver backed by storage.
 */
export function createDidResolver(
  storage: {
    get(key: Uint8Array): Uint8Array | undefined;
    set(key: Uint8Array, value: Uint8Array): void;
  }
): DidResolver {
  const getDoc = (did: string): DidDocument | null => {
    const key = new TextEncoder().encode(didDocumentKey(did));
    const data = storage.get(key);
    if (!data || data.length === 0) return null;
    return deserializeDidDocument(data);
  };

  const setDoc = (doc: DidDocument): void => {
    const key = new TextEncoder().encode(didDocumentKey(doc.id));
    storage.set(key, serializeDidDocument(doc));
  };

  return {
    async resolve(did: string): Promise<DidDocument | null> {
      return getDoc(did);
    },

    async register(doc: DidDocument, _signature?: string): Promise<boolean> {
      // Check if DID already exists
      const existing = getDoc(doc.id);
      if (existing) {
        return false; // Already registered
      }
      setDoc(doc);
      return true;
    },

    async update(
      did: string,
      updates: Partial<DidDocument>,
      signature: string
    ): Promise<boolean> {
      const existing = getDoc(did);
      if (!existing || !existing.active) {
        return false;
      }
      
      // Verify signature against existing public key
      // Message format: "did:update:<did>:<timestamp>:<updates_hash>"
      const timestamp = Date.now();
      const updatesJson = JSON.stringify(updates);
      const updatesHash = await sha256Hex(new TextEncoder().encode(updatesJson));
      const message = `did:update:${did}:${timestamp}:${updatesHash}`;
      const messageBytes = new TextEncoder().encode(message);
      
      try {
        const signatureBytes = base64ToBytes(signature);
        const publicKeyBytes = hexToBytes(existing.publicKeyHex);
        
        // For ed25519 algorithm, verify directly
        if (existing.algorithm === "ed25519") {
          const valid = await verifyEd25519(messageBytes, signatureBytes, publicKeyBytes);
          if (!valid) {
            console.error("[DID] Update signature verification failed for:", did);
            return false;
          }
        } else {
          // For other algorithms (e.g., PQ), signature verification would need external verifier
          // For now, reject non-ed25519 updates without proper verification
          console.warn("[DID] Non-ed25519 algorithm requires external verification:", existing.algorithm);
          return false;
        }
      } catch (error) {
        console.error("[DID] Signature verification error:", error);
        return false;
      }
      
      const updated: DidDocument = {
        ...existing,
        ...updates,
        id: did, // Cannot change DID
        created: existing.created, // Cannot change creation time
        updated: timestamp,
      };
      setDoc(updated);
      return true;
    },

    async deactivate(did: string, signature: string): Promise<boolean> {
      const existing = getDoc(did);
      if (!existing) {
        return false;
      }
      
      // Verify signature against existing public key
      // Message format: "did:deactivate:<did>:<timestamp>"
      const timestamp = Date.now();
      const message = `did:deactivate:${did}:${timestamp}`;
      const messageBytes = new TextEncoder().encode(message);
      
      try {
        const signatureBytes = base64ToBytes(signature);
        const publicKeyBytes = hexToBytes(existing.publicKeyHex);
        
        // For ed25519 algorithm, verify directly
        if (existing.algorithm === "ed25519") {
          const valid = await verifyEd25519(messageBytes, signatureBytes, publicKeyBytes);
          if (!valid) {
            console.error("[DID] Deactivate signature verification failed for:", did);
            return false;
          }
        } else {
          // For other algorithms (e.g., PQ), signature verification would need external verifier
          console.warn("[DID] Non-ed25519 algorithm requires external verification:", existing.algorithm);
          return false;
        }
      } catch (error) {
        console.error("[DID] Signature verification error:", error);
        return false;
      }
      
      setDoc({ ...existing, active: false, updated: timestamp });
      return true;
    },
  };
}

/* ───────────────────────── Block Header Extension ───────────────────────── */

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
export function createSecureHeaderData(
  genesisHash: string,
  totalSupply: bigint,
  supplyCap: bigint
): SecureBlockHeader {
  return {
    genesisHash,
    totalSupply: totalSupply.toString(),
    supplyCap: supplyCap.toString(),
  };
}
