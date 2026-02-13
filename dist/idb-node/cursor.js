/**
 * IDBCursor / IDBCursorWithValue: powered by backend.scan().
 */
import { encodeKey } from "./key-codec.js";
export class FakeIDBCursor {
    results;
    index;
    _source;
    _storeName;
    _request = null;
    constructor(storeName, source, backend, range, direction, request) {
        this._storeName = storeName;
        this._source = source;
        this._request = request ?? null;
        const dir = direction === "prev" || direction === "prevunique" ? "prev" : "next";
        this.results = backend.scan(storeName, range ?? {}, dir);
        this.index = 0;
    }
    get key() {
        return this.results[this.index]?.key;
    }
    get primaryKey() {
        return this.results[this.index]?.key;
    }
    get value() {
        return this.results[this.index]?.value;
    }
    get source() {
        return this._source;
    }
    get storeName() {
        return this._storeName;
    }
    continue(key) {
        if (key !== undefined) {
            const keyHex = encodeKey(key).toString("hex");
            const nextIdx = this.results.findIndex((r, i) => i > this.index && encodeKey(r.key).toString("hex") >= keyHex);
            this.index = nextIdx === -1 ? this.results.length : nextIdx;
        }
        else {
            this.index++;
        }
        this._fireRequest();
    }
    advance(count) {
        this.index += count;
        this._fireRequest();
    }
    _fireRequest() {
        if (!this._request)
            return;
        const req = this._request;
        const done = this.finished;
        const cursor = done ? null : this;
        queueMicrotask(() => req._resolve(cursor));
    }
    get finished() {
        return this.index >= this.results.length;
    }
}
export class FakeIDBCursorWithValue extends FakeIDBCursor {
    get value() {
        return super.value;
    }
}
