/**
 * Event-based IDBRequest simulation (async via queueMicrotask).
 */
export class FakeIDBRequest extends EventTarget {
    result = undefined;
    error = null;
    readyState = "pending";
    onsuccess = null;
    onerror = null;
    _resolve(value) {
        this.result = value;
        this.readyState = "done";
        queueMicrotask(() => {
            const event = new Event("success");
            if (this.onsuccess)
                this.onsuccess(event);
            this.dispatchEvent(event);
        });
    }
    _reject(err) {
        this.error = err instanceof DOMException ? err : new DOMException(err.message, "UnknownError");
        this.readyState = "done";
        queueMicrotask(() => {
            const event = new Event("error");
            if (this.onerror)
                this.onerror(event);
            this.dispatchEvent(event);
        });
    }
    toPromise() {
        return new Promise((resolve, reject) => {
            this.onsuccess = () => resolve(this.result);
            this.onerror = () => reject(this.error);
        });
    }
}
export class FakeIDBOpenDBRequest extends FakeIDBRequest {
    onblocked = null;
    onupgradeneeded = null;
}
