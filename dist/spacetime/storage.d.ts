import type { StorageAdapter } from "../storage.js";
import type { SpaceTimeStorage } from "./types.js";
export declare function createSpaceTimeStorage(adapter: StorageAdapter, namespace?: string): SpaceTimeStorage;
