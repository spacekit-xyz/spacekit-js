/**
 * IDBObjectStore implementation over WalBackend + transaction.
 */
import type { WalBackend } from "./wal-backend.js";
import type { IDBTransactionImpl } from "./transaction.js";
import { FakeIDBRequest } from "./request.js";
import type { IDBCursorDirection } from "./cursor.js";
export interface StoreParams {
    name: string;
    keyPath: string | string[] | null;
    autoIncrement: boolean;
}
export declare class FakeIDBObjectStore {
    private backend;
    readonly name: string;
    readonly keyPath: string | string[] | null;
    readonly autoIncrement: boolean;
    private getTransaction;
    constructor(backend: WalBackend, name: string, keyPath: string | string[] | null, autoIncrement: boolean, getTransaction: () => IDBTransactionImpl | null);
    private resolveKey;
    put(value: unknown, key?: IDBValidKey): FakeIDBRequest<IDBValidKey>;
    add(value: unknown, key?: IDBValidKey): FakeIDBRequest<IDBValidKey>;
    get(key: IDBValidKey): FakeIDBRequest<unknown>;
    delete(key: IDBValidKey): FakeIDBRequest<undefined>;
    clear(): FakeIDBRequest<undefined>;
    openCursor(range?: IDBKeyRange | null, direction?: IDBCursorDirection): FakeIDBRequest<IDBCursorWithValue | null>;
}
