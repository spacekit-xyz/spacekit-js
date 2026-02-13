/**
 * IDBObjectStore implementation over WalBackend + transaction.
 */
import { FakeIDBRequest } from "./request.js";
import { FakeIDBCursorWithValue } from "./cursor.js";
export class FakeIDBObjectStore {
    backend;
    name;
    keyPath;
    autoIncrement;
    getTransaction;
    constructor(backend, name, keyPath, autoIncrement, getTransaction) {
        this.backend = backend;
        this.name = name;
        this.keyPath = keyPath;
        this.autoIncrement = autoIncrement;
        this.getTransaction = getTransaction;
    }
    resolveKey(key, value) {
        if (key !== undefined)
            return key;
        if (this.keyPath !== null && value !== undefined && typeof value === "object" && value !== null) {
            const path = Array.isArray(this.keyPath) ? this.keyPath[0] : this.keyPath;
            const k = value[path];
            if (k !== undefined)
                return k;
        }
        throw new DOMException("Key is required", "DataError");
    }
    put(value, key) {
        const req = new FakeIDBRequest();
        const resolvedKey = this.resolveKey(key, value);
        const tx = this.getTransaction();
        if (tx) {
            tx.enqueuePut(this.name, resolvedKey, value);
            tx.addRequest(req, resolvedKey);
            queueMicrotask(() => tx.commit());
        }
        else {
            this.backend.put(this.name, resolvedKey, value);
            req._resolve(resolvedKey);
        }
        return req;
    }
    add(value, key) {
        const resolvedKey = this.resolveKey(key, value);
        const existing = this.backend.get(this.name, resolvedKey);
        if (existing !== undefined) {
            const req = new FakeIDBRequest();
            req._reject(new DOMException("Key already exists", "ConstraintError"));
            return req;
        }
        return this.put(value, key);
    }
    get(key) {
        const req = new FakeIDBRequest();
        const value = this.backend.get(this.name, key);
        queueMicrotask(() => req._resolve(value));
        return req;
    }
    delete(key) {
        const req = new FakeIDBRequest();
        const tx = this.getTransaction();
        if (tx) {
            tx.enqueueDelete(this.name, key);
            tx.addRequest(req, undefined);
            queueMicrotask(() => tx.commit());
        }
        else {
            this.backend.delete(this.name, key);
            req._resolve(undefined);
        }
        return req;
    }
    clear() {
        const req = new FakeIDBRequest();
        const tx = this.getTransaction();
        if (tx) {
            tx.enqueueClear(this.name);
            tx.addRequest(req, undefined);
            queueMicrotask(() => tx.commit());
        }
        else {
            this.backend.clear(this.name);
            req._resolve(undefined);
        }
        return req;
    }
    openCursor(range, direction) {
        const req = new FakeIDBRequest();
        const scanRange = rangeToScanRange(range);
        const dir = direction ?? "next";
        const source = { name: this.name, keyPath: this.keyPath, autoIncrement: this.autoIncrement };
        const cursor = new FakeIDBCursorWithValue(this.name, source, this.backend, scanRange, dir, req);
        queueMicrotask(() => {
            if (cursor.finished)
                req._resolve(null);
            else
                req._resolve(cursor);
        });
        return req;
    }
}
function rangeToScanRange(range) {
    if (!range)
        return {};
    const r = range;
    return {
        lower: r.lower,
        upper: r.upper,
        lowerOpen: r.lowerOpen,
        upperOpen: r.upperOpen,
    };
}
