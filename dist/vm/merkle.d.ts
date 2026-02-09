export type MerkleStep = {
    sibling: string;
    position: "left" | "right";
};
export declare function merkleRoot(leaves: string[]): Promise<string>;
export declare function merkleProof(leaves: string[], index: number): Promise<{
    root: string;
    proof: MerkleStep[];
}>;
export declare function verifyMerkleProof(leaf: string, proof: MerkleStep[], root: string): Promise<boolean>;
export declare function verifyMerkleProofFromHash(leafHash: string, proof: MerkleStep[], root: string): Promise<boolean>;
