import type { SpacekitVm } from "./spacekitvm.js";
export type ContractCallMode = "execute" | "submit";
export interface ContractCallCodec {
    encode(method: string, args: unknown[]): Uint8Array;
    decode<T>(method: string, output: Uint8Array): T;
}
export interface VmContractCallerOptions {
    callerDid: string;
    codec: ContractCallCodec;
    mode?: ContractCallMode;
    value?: bigint;
}
export declare function createVmContractCaller(vm: SpacekitVm, options: VmContractCallerOptions): <T>(contractId: string, method: string, args: unknown[]) => Promise<T>;
export declare const JsonContractCodec: ContractCallCodec;
