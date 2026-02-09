import type { BlockHeader, StateSnapshot } from "./spacekitvm.js";
export interface StateSnapshotChunk {
    id: string;
    hash: string;
}
export interface StateSnapshotEntry {
    keyHex: string;
    valueHex: string;
}
export interface StateSnapshotDocument {
    height: number;
    stateRoot: string;
    quantumStateRoot?: string;
    createdAt: number;
    chunks: StateSnapshotChunk[];
}
export interface SnapshotVerifyOptions {
    baseUrl?: string;
    fetcher?: typeof fetch;
    startIndex?: number;
    retries?: number;
    backoffMs?: number;
    onProgress?: (verified: number, total: number, chunkId: string) => void;
}
export interface SnapshotDownloadOptions extends SnapshotVerifyOptions {
    verify?: boolean;
    parseChunk?: (bytes: Uint8Array) => StateSnapshotEntry[];
    onChunkEntries?: (entries: StateSnapshotEntry[], chunkId: string) => void;
}
export interface SnapshotDeltaOptions extends SnapshotDownloadOptions {
    knownChunkIds?: string[];
}
export declare function fetchStateSnapshot(url: string, fetcher?: typeof fetch): Promise<StateSnapshotDocument>;
export declare function verifySnapshotAgainstHeader(snapshot: StateSnapshotDocument, header: BlockHeader | null): boolean;
export declare function fetchSnapshotChunk(url: string, fetcher?: typeof fetch): Promise<Uint8Array>;
export declare function verifySnapshotChunks(snapshotUrl: string, snapshot: StateSnapshotDocument, baseUrl?: string, fetcher?: typeof fetch, onProgress?: (verified: number, total: number, chunkId: string) => void): Promise<{
    verified: number;
    total: number;
}>;
export declare function verifySnapshotChunksResumable(snapshotUrl: string, snapshot: StateSnapshotDocument, options?: SnapshotVerifyOptions): Promise<{
    verified: number;
    total: number;
}>;
export declare function downloadStateSnapshot(snapshotUrl: string, snapshot: StateSnapshotDocument, options?: SnapshotDownloadOptions): Promise<StateSnapshot>;
export declare function downloadStateSnapshotDelta(snapshotUrl: string, snapshot: StateSnapshotDocument, options?: SnapshotDeltaOptions): Promise<{
    entries: StateSnapshotEntry[];
    fetched: number;
    skipped: number;
}>;
