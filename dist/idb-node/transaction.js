/**
 * Transaction: buffer writes and apply on commit; support abort.
 * Tracks requests so we can resolve them after commit.
 */
export class IDBTransactionImpl {
    mode;
    backend;
    onCommit;
    ops = [];
    pendingRequests = [];
    aborted = false;
    constructor(mode, backend, onCommit) {
        this.mode = mode;
        this.backend = backend;
        this.onCommit = onCommit;
    }
    enqueuePut(store, key, value) {
        if (this.aborted)
            throw new DOMException("Transaction aborted", "AbortError");
        if (this.mode === "readonly")
            throw new DOMException("Read-only transaction", "ReadOnlyError");
        this.ops.push({ store, op: "put", key, value });
    }
    enqueueDelete(store, key) {
        if (this.aborted)
            throw new DOMException("Transaction aborted", "AbortError");
        if (this.mode === "readonly")
            throw new DOMException("Read-only transaction", "ReadOnlyError");
        this.ops.push({ store, op: "del", key });
    }
    enqueueClear(store) {
        if (this.aborted)
            throw new DOMException("Transaction aborted", "AbortError");
        if (this.mode === "readonly")
            throw new DOMException("Read-only transaction", "ReadOnlyError");
        this.ops.push({ store, op: "clear" });
    }
    addRequest(request, resolveWith) {
        this.pendingRequests.push({ request, resolveWith });
    }
    commit() {
        if (this.aborted)
            return;
        this.onCommit(this.ops);
        for (const { request, resolveWith } of this.pendingRequests) {
            request._resolve(resolveWith);
        }
        this.pendingRequests = [];
        this.ops = [];
    }
    abort() {
        this.aborted = true;
        for (const { request } of this.pendingRequests) {
            request._reject(new DOMException("Transaction aborted", "AbortError"));
        }
        this.pendingRequests = [];
        this.ops = [];
    }
    get abortedFlag() {
        return this.aborted;
    }
}
