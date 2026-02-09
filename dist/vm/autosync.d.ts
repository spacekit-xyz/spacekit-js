import { SpacekitVm, type StateSnapshot } from "./spacekitvm.js";
import type { IndexedDbStorageAdapter } from "../storage.js";
export interface AutoSyncOptions {
    storage: IndexedDbStorageAdapter;
    snapshotIntervalMs?: number;
    syncIntervalMs?: number;
    onSnapshot?: (snapshot: StateSnapshot) => void;
}
export declare class VmAutoSync {
    private vm;
    private storage;
    private snapshotIntervalMs;
    private syncIntervalMs;
    private onSnapshot?;
    private snapshotTimer;
    private syncTimer;
    constructor(vm: SpacekitVm, options: AutoSyncOptions);
    initFromSnapshot(): Promise<StateSnapshot | null>;
    start(): void;
    stop(): void;
}
