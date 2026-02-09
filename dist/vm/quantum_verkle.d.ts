import { type QuantumVerkleWasmLoaderOptions } from "../quantum_verkle.js";
import { type StorageAdapter } from "../storage.js";
export interface QuantumVerkleEntry {
    keyHex: string;
    valueHex: string;
    auxHex?: string | null;
}
export interface QuantumVerkleProof {
    keyHex: string;
    valueHex: string | null;
    stateRoot: string;
    verkleProofHex: string;
}
export interface QuantumVerkleOptions extends QuantumVerkleWasmLoaderOptions {
    profile?: "binding" | "hiding";
}
export declare class QuantumVerkleBridge {
    private module;
    private constructor();
    static create(options?: QuantumVerkleOptions): Promise<QuantumVerkleBridge>;
    computeRoot(entries: QuantumVerkleEntry[]): Promise<string>;
    computeProof(entries: QuantumVerkleEntry[], keyHex: string): Promise<QuantumVerkleProof>;
    verifyProof(proof: QuantumVerkleProof): Promise<boolean>;
}
export declare function buildQuantumEntries(storage: StorageAdapter): QuantumVerkleEntry[];
export declare function verifyQuantumVerkleProof(proof: QuantumVerkleProof, options?: QuantumVerkleOptions): Promise<boolean>;
