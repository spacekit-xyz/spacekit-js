/**
 * Key encoding for IndexedDB-compatible lexicographic ordering.
 * Order: number < Date < string < binary < Array
 * Used by the WAL backend for range queries and cursors (no SQL).
 */
import { Buffer } from "node:buffer";
export declare const KeyType: {
    readonly NUMBER: 16;
    readonly DATE: 32;
    readonly STRING: 48;
    readonly BINARY: 64;
    readonly ARRAY: 80;
};
export declare function encodeKey(key: IDBValidKey): Buffer;
export declare function decodeKey(buf: Buffer): IDBValidKey;
/** Compare two encoded keys (lexicographic). Returns -1, 0, or 1. */
export declare function compareEncodedKeys(a: Buffer, b: Buffer): number;
