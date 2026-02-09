import { SpacekitVm } from "./spacekitvm.js";
import type { StorageNodeAdapter } from "../storage.js";
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
}
export interface BundleSigningOptions {
    privateKeyHex: string;
}
export declare class SpacekitSequencer {
    private vm;
    private maxBlocksPerBundle;
    private onBundle?;
    private lastSealedIndex;
    constructor(vm: SpacekitVm, options?: SequencerOptions);
    mineAndBundle(): Promise<RollupBundle | null>;
    flushBundle(): Promise<RollupBundle>;
    exportBundle(bundle: RollupBundle, storage: StorageNodeAdapter, collection?: string): Promise<boolean>;
    signBundle(bundle: RollupBundle, options: BundleSigningOptions): Promise<SignedRollupBundle>;
    exportSignedBundle(signedBundle: SignedRollupBundle, storage: StorageNodeAdapter, collection?: string): Promise<boolean>;
}
