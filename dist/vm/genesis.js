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
export const DEFAULT_GENESIS_CONFIG = {
    chainId: "spacekitvm-local",
    timestamp: Date.now(),
    version: "1.0.0",
    maxTxPerBlock: null,
    nativeCurrency: {
        symbol: "ASTRA",
        name: "ASTRA Native Token",
        decimals: 18,
        maxSupply: 1000000000000n, // 1 trillion max supply
        initialTreasurySupply: 100000000000n, // 100 billion to treasury
        mintable: false, // No minting after genesis
    },
    treasuryDid: "did:spacekit:treasury",
    initialDids: [],
};
/**
 * Get canonical string representation of genesis config for hashing.
 */
export function getGenesisCanonical(config) {
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
export async function computeGenesisHash(config) {
    const canonical = getGenesisCanonical(config);
    return sha256Hex(hashString(canonical));
}
/**
 * Compute genesis hash synchronously using a simple hash function.
 * Used for initialization before async context is available.
 */
export function computeGenesisHashSync(config) {
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
    "native:", // Native currency balances
    "did:document:", // DID documents
    "genesis:", // Genesis configuration
    "validator:", // Validator registry
    "governance:", // Governance state
];
/**
 * Check if a storage key is protected from contract modification.
 */
export function isProtectedKey(key) {
    return PROTECTED_PREFIXES.some(prefix => key.startsWith(prefix));
}
/**
 * Validate that a contract is not trying to write to protected storage.
 * @throws Error if the key is protected
 */
export function enforceStorageProtection(key, contractId) {
    if (isProtectedKey(key)) {
        throw new Error(`Contract ${contractId} cannot modify protected storage key: ${key}. ` +
            `Protected prefixes: ${PROTECTED_PREFIXES.join(", ")}`);
    }
}
/**
 * Validate a mint operation against the supply cap.
 * @throws Error if minting would exceed the cap or is not allowed
 */
export function validateMint(amount, state) {
    if (!state.mintable) {
        throw new Error("Native currency minting is disabled after genesis");
    }
    if (state.maxSupply > 0n) {
        const newSupply = state.currentSupply + amount;
        if (newSupply > state.maxSupply) {
            throw new Error(`Mint would exceed supply cap: ${newSupply} > ${state.maxSupply}`);
        }
    }
}
/**
 * Storage key for a DID document.
 */
export function didDocumentKey(did) {
    return `did:document:${did}`;
}
/**
 * Create a new DID document.
 */
export function createDidDocument(did, publicKeyHex, algorithm, controller) {
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
export function serializeDidDocument(doc) {
    const json = JSON.stringify(doc);
    return new TextEncoder().encode(json);
}
/**
 * Deserialize a DID document from storage.
 */
export function deserializeDidDocument(data) {
    try {
        const json = new TextDecoder().decode(data);
        return JSON.parse(json);
    }
    catch {
        return null;
    }
}
/**
 * Create a DID resolver backed by storage.
 */
export function createDidResolver(storage) {
    const getDoc = (did) => {
        const key = new TextEncoder().encode(didDocumentKey(did));
        const data = storage.get(key);
        if (!data || data.length === 0)
            return null;
        return deserializeDidDocument(data);
    };
    const setDoc = (doc) => {
        const key = new TextEncoder().encode(didDocumentKey(doc.id));
        storage.set(key, serializeDidDocument(doc));
    };
    return {
        async resolve(did) {
            return getDoc(did);
        },
        async register(doc, _signature) {
            // Check if DID already exists
            const existing = getDoc(doc.id);
            if (existing) {
                return false; // Already registered
            }
            setDoc(doc);
            return true;
        },
        async update(did, updates, signature) {
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
                }
                else {
                    // For other algorithms (e.g., PQ), signature verification would need external verifier
                    // For now, reject non-ed25519 updates without proper verification
                    console.warn("[DID] Non-ed25519 algorithm requires external verification:", existing.algorithm);
                    return false;
                }
            }
            catch (error) {
                console.error("[DID] Signature verification error:", error);
                return false;
            }
            const updated = {
                ...existing,
                ...updates,
                id: did, // Cannot change DID
                created: existing.created, // Cannot change creation time
                updated: timestamp,
            };
            setDoc(updated);
            return true;
        },
        async deactivate(did, signature) {
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
                }
                else {
                    // For other algorithms (e.g., PQ), signature verification would need external verifier
                    console.warn("[DID] Non-ed25519 algorithm requires external verification:", existing.algorithm);
                    return false;
                }
            }
            catch (error) {
                console.error("[DID] Signature verification error:", error);
                return false;
            }
            setDoc({ ...existing, active: false, updated: timestamp });
            return true;
        },
    };
}
/**
 * Create secure block header extension data.
 */
export function createSecureHeaderData(genesisHash, totalSupply, supplyCap) {
    return {
        genesisHash,
        totalSupply: totalSupply.toString(),
        supplyCap: supplyCap.toString(),
    };
}
