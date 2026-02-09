import { verifyQuantumVerkleProof } from "./quantum_verkle.js";
import { verifyMerkleProof, verifyMerkleProofFromHash } from "./merkle.js";
export async function verifyComputeNodeTxProof(proof, header) {
    const leafHash = strip0x(proof.txHash);
    const root = strip0x(proof.txRoot);
    if (header && strip0x(header.txRoot) !== root) {
        return false;
    }
    return verifyMerkleProofFromHash(leafHash, proof.proof, root);
}
export async function verifyComputeNodeReceiptProof(proof, header) {
    const leafHash = strip0x(proof.receiptHash);
    const root = strip0x(proof.receiptRoot);
    if (header && strip0x(header.receiptRoot) !== root) {
        return false;
    }
    return verifyMerkleProofFromHash(leafHash, proof.proof, root);
}
export async function verifyComputeNodeStateProof(proof, header) {
    if (!proof.valueHex) {
        return false;
    }
    const leaf = `${strip0x(proof.keyHex)}:${strip0x(proof.valueHex)}`;
    const root = strip0x(proof.stateRoot);
    if (header && strip0x(header.stateRoot) !== root) {
        return false;
    }
    return verifyMerkleProof(leaf, proof.proof, root);
}
export async function verifyComputeNodeQuantumStateProof(proof, header, options = {}) {
    if (header?.quantumStateRoot && header.quantumStateRoot !== proof.stateRoot) {
        return false;
    }
    if (!proof.valueHex) {
        return false;
    }
    return verifyQuantumVerkleProof(proof, options);
}
function strip0x(value) {
    if (!value) {
        return value;
    }
    return value.startsWith("0x") ? value.slice(2) : value;
}
