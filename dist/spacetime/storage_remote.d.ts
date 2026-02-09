import type { SpaceTimeStorage } from "./types.js";
export interface SpaceTimeStorageNodeOptions {
    baseUrl: string;
    did: string;
    collection?: string;
    namespace?: string;
}
export interface SpaceTimeStorageNodeFallbackOptions extends Omit<SpaceTimeStorageNodeOptions, "baseUrl"> {
    baseUrls: string[];
    probePath?: string;
}
export declare function createSpaceTimeStorageNode(options: SpaceTimeStorageNodeOptions): SpaceTimeStorage;
export declare function createSpaceTimeStorageNodeWithFallback(options: SpaceTimeStorageNodeFallbackOptions): Promise<SpaceTimeStorage>;
