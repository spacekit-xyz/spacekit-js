export interface SnapshotProgressEntry {
    snapshotUrl: string;
    verified: number;
    total: number;
    updatedAt: number;
}
export declare class IndexedDbSnapshotProgress {
    private dbName;
    private storeName;
    private db;
    constructor(dbName?: string, storeName?: string);
    init(): Promise<void>;
    private openDb;
    save(entry: SnapshotProgressEntry): Promise<void>;
    load(snapshotUrl: string): Promise<SnapshotProgressEntry | null>;
}
