import { sha256Hex, hashString } from "./hash.js";
import { bytesToHex, hexToBytes } from "../storage.js";
function generateBundleId() {
    return `bundle_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
export class SpacekitSequencer {
    vm;
    maxBlocksPerBundle;
    onBundle;
    proofBridgeAdapters;
    lastSealedIndex = 0;
    constructor(vm, options = {}) {
        this.vm = vm;
        this.maxBlocksPerBundle = options.maxBlocksPerBundle ?? 10;
        this.onBundle = options.onBundle;
        this.proofBridgeAdapters = options.proofBridgeAdapters;
    }
    async mineAndBundle() {
        const block = await this.vm.mineBlock();
        if (!block) {
            return null;
        }
        const blocks = this.vm.getBlocks();
        if (blocks.length >= this.maxBlocksPerBundle) {
            return this.flushBundle();
        }
        return null;
    }
    async flushBundle() {
        const blocks = this.vm.getBlocks();
        if (blocks.length === 0) {
            throw new Error("No blocks to bundle");
        }
        const fromHeight = blocks[0].height;
        const toHeight = blocks[blocks.length - 1].height;
        const timestamp = Date.now();
        const blockHashes = blocks.map((b) => b.blockHash);
        const stateRoots = blocks.map((b) => b.stateRoot);
        const quantumStateRoots = blocks.every((b) => b.quantumStateRoot)
            ? blocks.map((b) => b.quantumStateRoot)
            : undefined;
        const txRoots = blocks.map((b) => b.txRoot);
        const receiptRoots = blocks.map((b) => b.receiptRoot);
        const sealedArchives = this.vm.getSealedArchives().slice(this.lastSealedIndex);
        this.lastSealedIndex = this.vm.getSealedArchives().length;
        const payload = {
            fromHeight,
            toHeight,
            blockHashes,
            stateRoots,
            quantumStateRoots,
            txRoots,
            receiptRoots,
            sealedArchives,
            timestamp,
        };
        const bundleHash = await sha256Hex(hashString(JSON.stringify(payload)));
        const bundle = {
            bundleId: generateBundleId(),
            fromHeight,
            toHeight,
            blockCount: blocks.length,
            blockHashes,
            stateRoots,
            quantumStateRoots,
            txRoots,
            receiptRoots,
            sealedArchives,
            timestamp,
            bundleHash,
        };
        if (this.onBundle) {
            this.onBundle(bundle);
        }
        for (const adapter of this.proofBridgeAdapters ?? []) {
            if (!adapter.isReady())
                continue;
            try {
                await adapter.submit({ kind: "bundle", bundle });
            }
            catch (_e) {
                // Log and continue; caller can add retry or logging
            }
        }
        return bundle;
    }
    async exportBundle(bundle, storage, collection = "spacekitvm_rollups") {
        return storage.putDocument(collection, bundle.bundleId, {
            bundle,
            exported_at: Date.now(),
        });
    }
    async signBundle(bundle, options) {
        const ed = await import("@noble/ed25519");
        const privateKey = hexToBytes(options.privateKeyHex);
        const publicKey = await ed.getPublicKey(privateKey);
        const signature = await ed.sign(hexToBytes(bundle.bundleHash), privateKey);
        return {
            ...bundle,
            signature: {
                algorithm: "ed25519",
                publicKeyHex: bytesToHex(publicKey),
                signatureBase64: toBase64(signature),
            },
        };
    }
    async exportSignedBundle(signedBundle, storage, collection = "spacekitvm_rollups") {
        for (const adapter of this.proofBridgeAdapters ?? []) {
            if (!adapter.isReady())
                continue;
            try {
                await adapter.submit({ kind: "signed_bundle", signed: signedBundle });
            }
            catch (_e) {
                // Log and continue
            }
        }
        return storage.putDocument(collection, signedBundle.bundleId, {
            bundle: signedBundle,
            exported_at: Date.now(),
        });
    }
}
function toBase64(bytes) {
    if (typeof btoa !== "undefined") {
        let binary = "";
        for (const b of bytes) {
            binary += String.fromCharCode(b);
        }
        return btoa(binary);
    }
    return Buffer.from(bytes).toString("base64");
}
