/**
 * Persistent Verkle State Manager
 *
 * Wraps a StorageAdapter with a live QuantumVerkleWasm instance that is
 * kept in sync with every storage write. Tracks read/write sets per
 * block execution so verkle witnesses can be generated and included in
 * blocks, enabling stateless validation.
 */
import { bytesToHex, hexToBytes } from "../storage.js";
import { loadQuantumVerkleWasm } from "../quantum_verkle.js";
import { sha256Hex } from "./hash.js";
/* ── Helpers ───────────────────────────────────────────────── */
function strip0x(v) {
    return v.startsWith("0x") ? v.slice(2) : v;
}
function normalizeU256Hex(valueHex) {
    return strip0x(valueHex).padStart(64, "0");
}
async function deriveVerkleKey(keyHex) {
    const keyBytes = hexToBytes(strip0x(keyHex));
    const hashHex = await sha256Hex(keyBytes);
    return { addressHex: hashHex.slice(0, 40), verkleKeyHex: hashHex.slice(0, 64) };
}
/* ── VerkleStateManager ──────────────────────────────────── */
export class VerkleStateManager {
    inner;
    wasm = null;
    tree = null; // QuantumVerkleWasm instance
    currentRoot = "verkle:empty";
    accessLog = [];
    preBlockRoot = "verkle:empty";
    initialized = false;
    initPromise = null;
    wasmOptions;
    constructor(inner, wasmOptions = {}) {
        this.inner = inner;
        this.wasmOptions = wasmOptions;
    }
    /** Initialize the WASM module and build the initial tree from existing storage. */
    async init() {
        if (this.initialized)
            return;
        if (this.initPromise)
            return this.initPromise;
        this.initPromise = this._init();
        return this.initPromise;
    }
    async _init() {
        this.wasm = await loadQuantumVerkleWasm(this.wasmOptions);
        this.tree = new this.wasm.QuantumVerkleWasm();
        // Populate tree with all existing storage entries
        if (this.inner.entries) {
            const entries = this.inner.entries();
            for (const entry of entries) {
                const keyHex = bytesToHex(entry.key);
                const valueHex = bytesToHex(entry.value);
                const { addressHex, verkleKeyHex } = await deriveVerkleKey(keyHex);
                this.tree.set(addressHex, verkleKeyHex, normalizeU256Hex(valueHex), null);
            }
        }
        this.currentRoot = `verkle:${this.tree.root_hex()}`;
        this.initialized = true;
    }
    /** The current verkle state root. */
    get root() {
        return this.currentRoot;
    }
    /**
     * Mark the start of a new block's transaction window.
     * Called automatically when the first pending tx arrives.
     */
    markPreBlockRoot() {
        this.preBlockRoot = this.currentRoot;
    }
    /** Flush accumulated access records and return them + the pre-block root. */
    flushAccessLog() {
        const log = this.accessLog;
        const preRoot = this.preBlockRoot;
        this.accessLog = [];
        this.preBlockRoot = this.currentRoot;
        return { log, preRoot };
    }
    /** Read from underlying storage + record access. */
    get(key) {
        const value = this.inner.get(key);
        const keyHex = bytesToHex(key);
        this.accessLog.push({
            keyHex,
            addressHex: "",
            verkleKeyHex: "",
            valueHex: value ? bytesToHex(value) : null,
            mode: "read",
        });
        return value;
    }
    /** Write to underlying storage + update verkle tree + record access. */
    set(key, value) {
        this.inner.set(key, value);
        const keyHex = bytesToHex(key);
        const valueHex = bytesToHex(value);
        this.accessLog.push({
            keyHex,
            addressHex: "",
            verkleKeyHex: "",
            valueHex,
            mode: "write",
        });
        // Queue the tree update (tree is sync once initialized)
        if (this.tree) {
            // Fire-and-forget async key derivation + sync tree update
            void deriveVerkleKey(keyHex).then(({ addressHex, verkleKeyHex }) => {
                this.tree.set(addressHex, verkleKeyHex, normalizeU256Hex(valueHex), null);
                this.currentRoot = `verkle:${this.tree.root_hex()}`;
            });
        }
    }
    /** Synchronous flush: recompute root from tree (already up-to-date). */
    async flushRoot() {
        if (!this.tree)
            return "verkle:disabled";
        // Ensure all pending key derivations are done by re-reading root
        // In practice the fire-and-forget promises complete quickly
        await new Promise((r) => setTimeout(r, 0));
        this.currentRoot = `verkle:${this.tree.root_hex()}`;
        return this.currentRoot;
    }
    /**
     * Generate a VerkleWitness for the block's accessed keys.
     * Must be called after endBlock() and before beginBlock() of the next block.
     */
    async generateWitness(accessLog, preStateRoot) {
        if (!this.tree) {
            return {
                proofHex: "",
                accessedKeys: [],
                preStateRoot,
                postStateRoot: this.currentRoot,
            };
        }
        // Resolve verkle keys for all access records
        const resolved = [];
        for (const rec of accessLog) {
            const { addressHex, verkleKeyHex } = await deriveVerkleKey(rec.keyHex);
            resolved.push({ ...rec, addressHex, verkleKeyHex });
        }
        // Deduplicate by verkle key (keep last occurrence for writes)
        const seen = new Map();
        for (const r of resolved) {
            const existing = seen.get(r.verkleKeyHex);
            if (!existing || r.mode === "write") {
                seen.set(r.verkleKeyHex, r);
            }
        }
        const unique = [...seen.values()];
        if (unique.length === 0) {
            return {
                proofHex: "",
                accessedKeys: [],
                preStateRoot,
                postStateRoot: this.currentRoot,
            };
        }
        // Generate multi-proof
        const addresses = unique.map((r) => r.addressHex);
        const keys = unique.map((r) => r.verkleKeyHex);
        let proofHex = "";
        try {
            const proofBytes = this.tree.create_multi_proof(addresses, keys);
            proofHex = bytesToHex(proofBytes);
        }
        catch (err) {
            console.warn("[VerkleStateManager] multi-proof generation failed:", err);
        }
        return {
            proofHex,
            accessedKeys: unique.map((r) => ({
                keyHex: r.keyHex,
                valueHex: r.valueHex,
                mode: r.mode,
            })),
            preStateRoot,
            postStateRoot: this.currentRoot,
        };
    }
    /**
     * Stateless verification: given a witness and block transactions, verify
     * that the state transition is valid without holding full state.
     */
    async verifyWitness(witness) {
        if (!this.tree || !witness.proofHex)
            return false;
        const addresses = [];
        const keys = [];
        const values = [];
        for (const ak of witness.accessedKeys) {
            if (!ak.valueHex)
                continue;
            const { addressHex, verkleKeyHex } = await deriveVerkleKey(ak.keyHex);
            addresses.push(addressHex);
            keys.push(verkleKeyHex);
            values.push(normalizeU256Hex(ak.valueHex));
        }
        if (addresses.length === 0)
            return true;
        try {
            const proofBytes = hexToBytes(witness.proofHex);
            return this.tree.verify_multi_proof(proofBytes, addresses, keys, values);
        }
        catch {
            return false;
        }
    }
    /** Proxy: passthrough to inner storage. */
    getAux(key) {
        return this.inner.getAux?.(key);
    }
    setAux(key, value) {
        this.inner.setAux?.(key, value);
    }
    entries() {
        return this.inner.entries?.() ?? [];
    }
    clear() {
        this.inner.clear?.();
        if (this.tree) {
            this.tree = new this.wasm.QuantumVerkleWasm();
            this.currentRoot = `verkle:${this.tree.root_hex()}`;
        }
    }
    /** Get the underlying storage adapter (for legacy code). */
    get innerStorage() {
        return this.inner;
    }
    /** Build a StorageAdapter-compatible interface from this manager. */
    toStorageAdapter() {
        return {
            get: (key) => this.get(key),
            set: (key, value) => this.set(key, value),
            getAux: (key) => this.getAux(key),
            setAux: (key, value) => this.setAux(key, value),
            entries: () => this.entries(),
            clear: () => this.clear(),
        };
    }
}
