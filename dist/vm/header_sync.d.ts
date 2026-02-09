import type { BlockHeader, QuantumStateProof } from "./spacekitvm.js";
import type { QuantumVerkleOptions } from "./quantum_verkle.js";
import type { ComputeNodeReceiptProof, ComputeNodeTxProof } from "./light_client.js";
export interface HeaderSyncClientOptions {
    rpcUrl: string;
    fetcher?: typeof fetch;
    quantumVerkle?: QuantumVerkleOptions;
}
export type HeaderSyncResult = {
    headers: BlockHeader[];
    latestHeight: number;
};
export declare class HeaderSyncClient {
    private rpcUrl;
    private fetcher;
    private quantumVerkle;
    constructor(options: HeaderSyncClientOptions);
    getLatestHeight(): Promise<number>;
    getChainId(): Promise<string | null>;
    getHeader(height: number): Promise<BlockHeader | null>;
    syncHeaders(fromHeight?: number, toHeight?: number): Promise<HeaderSyncResult>;
    verifyReceiptProof(proof: ComputeNodeReceiptProof, header?: BlockHeader): Promise<boolean>;
    verifyTxProof(proof: ComputeNodeTxProof, header?: BlockHeader): Promise<boolean>;
    getQuantumStateRoot(): Promise<string>;
    getQuantumStateProof(keyHex: string): Promise<QuantumStateProof>;
    verifyQuantumStateProof(proof: QuantumStateProof, header?: BlockHeader): Promise<boolean>;
    private rpcCall;
}
