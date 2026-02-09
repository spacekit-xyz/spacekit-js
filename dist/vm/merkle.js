import { sha256Hex, hashString } from "./hash.js";
export async function merkleRoot(leaves) {
    if (leaves.length === 0) {
        return "merkle:empty";
    }
    let level = await Promise.all(leaves.map((leaf) => hashLeaf(leaf)));
    while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = level[i + 1] ?? left;
            next.push(await hashPair(left, right));
        }
        level = next;
    }
    return level[0];
}
export async function merkleProof(leaves, index) {
    if (leaves.length === 0) {
        return { root: "merkle:empty", proof: [] };
    }
    let level = await Promise.all(leaves.map((leaf) => hashLeaf(leaf)));
    let idx = index;
    const proof = [];
    while (level.length > 1) {
        const isRight = idx % 2 === 1;
        const siblingIndex = isRight ? idx - 1 : idx + 1;
        const sibling = level[siblingIndex] ?? level[idx];
        proof.push({ sibling, position: isRight ? "left" : "right" });
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = level[i + 1] ?? left;
            next.push(await hashPair(left, right));
        }
        level = next;
        idx = Math.floor(idx / 2);
    }
    return { root: level[0], proof };
}
export async function verifyMerkleProof(leaf, proof, root) {
    let hash = await hashLeaf(leaf);
    for (const step of proof) {
        if (step.position === "left") {
            hash = await hashPair(step.sibling, hash);
        }
        else {
            hash = await hashPair(hash, step.sibling);
        }
    }
    return hash === root;
}
export async function verifyMerkleProofFromHash(leafHash, proof, root) {
    let hash = leafHash;
    for (const step of proof) {
        if (step.position === "left") {
            hash = await hashPair(step.sibling, hash);
        }
        else {
            hash = await hashPair(hash, step.sibling);
        }
    }
    return hash === root;
}
async function hashLeaf(value) {
    return sha256Hex(hashString(`leaf:${value}`));
}
async function hashPair(left, right) {
    return sha256Hex(hashString(`node:${left}:${right}`));
}
