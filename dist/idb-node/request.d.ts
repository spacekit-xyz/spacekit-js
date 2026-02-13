/**
 * Event-based IDBRequest simulation (async via queueMicrotask).
 */
export declare class FakeIDBRequest<T = unknown> extends EventTarget {
    result: T | undefined;
    error: DOMException | null;
    readyState: "pending" | "done";
    onsuccess: ((ev: Event) => void) | null;
    onerror: ((ev: Event) => void) | null;
    _resolve(value: T): void;
    _reject(err: Error): void;
    toPromise(): Promise<T>;
}
export declare class FakeIDBOpenDBRequest extends FakeIDBRequest<IDBDatabase> {
    onblocked: ((ev: Event) => void) | null;
    onupgradeneeded: ((ev: IDBVersionChangeEvent) => void) | null;
}
