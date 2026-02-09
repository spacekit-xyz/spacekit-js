import type { StorageNodeAdapter } from "../storage.js";
type ContractCall = <T>(address: string, method: string, args: unknown[]) => Promise<T>;
interface SpaceTimeStorageContractOptions {
    storage: StorageNodeAdapter;
    callerDid: string;
    collection?: string;
}
export declare function createSpaceTimeStorageContractCaller(options: SpaceTimeStorageContractOptions): ContractCall;
export {};
