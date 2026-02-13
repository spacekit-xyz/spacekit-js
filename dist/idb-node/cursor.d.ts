/**
 * IDBCursor / IDBCursorWithValue: powered by backend.scan().
 */
import type { WalBackend } from "./wal-backend.js";
import type { ScanRange } from "./wal-backend.js";
import type { FakeIDBRequest } from "./request.js";
export type IDBCursorDirection = "next" | "nextunique" | "prev" | "prevunique";
export interface CursorSource {
    readonly name: string;
    readonly keyPath: string | string[] | null;
    readonly autoIncrement: boolean;
}
export declare class FakeIDBCursor {
    protected results: Array<{
        key: IDBValidKey;
        value: unknown;
    }>;
    protected index: number;
    private _source;
    private _storeName;
    private _request;
    constructor(storeName: string, source: CursorSource, backend: WalBackend, range: ScanRange | null, direction: IDBCursorDirection, request?: FakeIDBRequest<IDBCursorWithValue | null>);
    get key(): IDBValidKey;
    get primaryKey(): IDBValidKey;
    get value(): unknown;
    get source(): CursorSource;
    get storeName(): string;
    continue(key?: IDBValidKey): void;
    advance(count: number): void;
    private _fireRequest;
    get finished(): boolean;
}
export declare class FakeIDBCursorWithValue extends FakeIDBCursor {
    get value(): unknown;
}
