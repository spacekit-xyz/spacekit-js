import type { MerkleStep } from "./merkle.js";
import type { QuantumStateProof } from "./spacekitvm.js";
import { type QuantumVerkleOptions } from "./quantum_verkle.js";
export interface ComputeNodeBlockHeader {
    blockHash: string;
    txRoot: string;
    receiptRoot: string;
    stateRoot: string;
    quantumStateRoot?: string;
    height: number;
}
export interface ComputeNodeTxProof {
    txHash: string;
    txRoot: string;
    index: number;
    blockHash: string;
    blockHeight: number;
    proof: MerkleStep[];
}
export interface ComputeNodeReceiptProof {
    txHash: string;
    receiptHash: string;
    receiptRoot: string;
    index: number;
    blockHash: string;
    blockHeight: number;
    proof: MerkleStep[];
}
export interface ComputeNodeStateProof {
    keyHex: string;
    valueHex: string | null;
    stateRoot: string;
    proofHash: string;
    proof: MerkleStep[];
}
export declare function verifyComputeNodeTxProof(proof: ComputeNodeTxProof, header?: ComputeNodeBlockHeader): Promise<boolean>;
export declare function verifyComputeNodeReceiptProof(proof: ComputeNodeReceiptProof, header?: ComputeNodeBlockHeader): Promise<boolean>;
export declare function verifyComputeNodeStateProof(proof: ComputeNodeStateProof, header?: ComputeNodeBlockHeader): Promise<boolean>;
export declare function verifyComputeNodeQuantumStateProof(proof: QuantumStateProof, header?: ComputeNodeBlockHeader, options?: QuantumVerkleOptions): Promise<boolean>;
