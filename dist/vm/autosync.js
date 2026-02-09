const snapshotKey = new TextEncoder().encode("__spacekitvm_snapshot__");
export class VmAutoSync {
    vm;
    storage;
    snapshotIntervalMs;
    syncIntervalMs;
    onSnapshot;
    snapshotTimer = null;
    syncTimer = null;
    constructor(vm, options) {
        this.vm = vm;
        this.storage = options.storage;
        this.snapshotIntervalMs = options.snapshotIntervalMs ?? 10_000;
        this.syncIntervalMs = options.syncIntervalMs ?? 5_000;
        this.onSnapshot = options.onSnapshot;
    }
    async initFromSnapshot() {
        await this.storage.init();
        const snapshotBytes = this.storage.get(snapshotKey);
        if (!snapshotBytes) {
            return null;
        }
        const json = new TextDecoder().decode(snapshotBytes);
        const snapshot = JSON.parse(json);
        this.vm.restoreSnapshot(snapshot);
        return snapshot;
    }
    start() {
        if (this.syncTimer !== null || this.snapshotTimer !== null) {
            return;
        }
        this.syncTimer = window.setInterval(() => {
            void this.storage.syncAll();
        }, this.syncIntervalMs);
        this.snapshotTimer = window.setInterval(async () => {
            const snapshot = await this.vm.createSnapshot();
            const json = JSON.stringify(snapshot);
            this.storage.set(snapshotKey, new TextEncoder().encode(json));
            void this.storage.syncAll();
            if (this.onSnapshot) {
                this.onSnapshot(snapshot);
            }
        }, this.snapshotIntervalMs);
    }
    stop() {
        if (this.syncTimer !== null) {
            window.clearInterval(this.syncTimer);
            this.syncTimer = null;
        }
        if (this.snapshotTimer !== null) {
            window.clearInterval(this.snapshotTimer);
            this.snapshotTimer = null;
        }
    }
}
