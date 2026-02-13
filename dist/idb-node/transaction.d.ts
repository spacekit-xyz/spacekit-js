/**
 * Transaction: buffer writes and apply on commit; support abort.
 * Tracks requests so we can resolve them after commit.
 */
import type { WalBackend } from "./wal-backend.js";
import type { FakeIDBRequest } from "./request.js";
export type TransactionMode = "readonly" | "readwrite" | "versionchange";
export interface QueuedOp {
    store: string;
    op: "put" | "del" | "clear";
    key?: IDBValidKey;
    value?: unknown;
}
export declare class IDBTransactionImpl {
    readonly mode: TransactionMode;
    private backend;
    private onCommit;
    private ops;
    private pendingRequests;
    private aborted;
    constructor(mode: TransactionMode, backend: WalBackend, onCommit: (ops: QueuedOp[]) => void);
    enqueuePut(store: string, key: IDBValidKey, value: unknown): void;
    enqueueDelete(store: string, key: IDBValidKey): void;
    enqueueClear(store: string): void;
    addRequest(request: FakeIDBRequest, resolveWith: IDBValidKey | undefined): void;
    commit(): void;
    abort(): void;
    get abortedFlag(): boolean;
}
