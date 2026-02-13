import { SpacekitVm } from "./spacekitvm.js";
import { sha256Hex, hashString } from "./hash.js";
import type { StorageNodeAdapter } from "../storage.js";
import { bytesToHex, hexToBytes } from "../storage.js";
import type { ProofBridgeAdapter } from "./proof_bridge.js";

export interface RollupBundle {
  bundleId: string;
  fromHeight: number;
  toHeight: number;
  blockCount: number;
  blockHashes: string[];
  stateRoots: string[];
  quantumStateRoots?: string[];
  txRoots: string[];
  receiptRoots: string[];
  sealedArchives: Array<{
    fromHeight: number;
    toHeight: number;
    blockCount: number;
    sealHash: string;
    timestamp: number;
  }>;
  timestamp: number;
  bundleHash: string;
}

export interface BundleSignature {
  algorithm: "ed25519";
  publicKeyHex: string;
  signatureBase64: string;
}

export interface SignedRollupBundle extends RollupBundle {
  signature: BundleSignature;
}

export interface SequencerOptions {
  maxBlocksPerBundle?: number;
  onBundle?: (bundle: RollupBundle) => void;
  /** Optional adapters to submit bundles/proofs to other chains (Ethereum, Bitcoin, Solana). */
  proofBridgeAdapters?: ProofBridgeAdapter[];
}

export interface BundleSigningOptions {
  privateKeyHex: string;
}

function generateBundleId(): string {
  return `bundle_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

export class SpacekitSequencer {
  private vm: SpacekitVm;
  private maxBlocksPerBundle: number;
  private onBundle?: (bundle: RollupBundle) => void;
  private proofBridgeAdapters?: ProofBridgeAdapter[];
  private lastSealedIndex = 0;

  constructor(vm: SpacekitVm, options: SequencerOptions = {}) {
    this.vm = vm;
    this.maxBlocksPerBundle = options.maxBlocksPerBundle ?? 10;
    this.onBundle = options.onBundle;
    this.proofBridgeAdapters = options.proofBridgeAdapters;
  }

  async mineAndBundle(): Promise<RollupBundle | null> {
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

  async flushBundle(): Promise<RollupBundle> {
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
      ? blocks.map((b) => b.quantumStateRoot as string)
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
    const bundle: RollupBundle = {
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
      if (!adapter.isReady()) continue;
      try {
        await adapter.submit({ kind: "bundle", bundle });
      } catch (_e) {
        // Log and continue; caller can add retry or logging
      }
    }
    return bundle;
  }

  async exportBundle(bundle: RollupBundle, storage: StorageNodeAdapter, collection = "spacekitvm_rollups") {
    return storage.putDocument(collection, bundle.bundleId, {
      bundle,
      exported_at: Date.now(),
    });
  }

  async signBundle(bundle: RollupBundle, options: BundleSigningOptions): Promise<SignedRollupBundle> {
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

  async exportSignedBundle(
    signedBundle: SignedRollupBundle,
    storage: StorageNodeAdapter,
    collection = "spacekitvm_rollups"
  ) {
    for (const adapter of this.proofBridgeAdapters ?? []) {
      if (!adapter.isReady()) continue;
      try {
        await adapter.submit({ kind: "signed_bundle", signed: signedBundle });
      } catch (_e) {
        // Log and continue
      }
    }
    return storage.putDocument(collection, signedBundle.bundleId, {
      bundle: signedBundle,
      exported_at: Date.now(),
    });
  }
}

function toBase64(bytes: Uint8Array): string {
  if (typeof btoa !== "undefined") {
    let binary = "";
    for (const b of bytes) {
      binary += String.fromCharCode(b);
    }
    return btoa(binary);
  }
  return Buffer.from(bytes).toString("base64");
}
