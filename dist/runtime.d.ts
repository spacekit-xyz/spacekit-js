import type { HostContext } from "./host.js";
export interface InstantiatedContract {
    instance: WebAssembly.Instance;
    module: WebAssembly.Module;
}
export declare function instantiateWasm(wasm: ArrayBuffer | Uint8Array | Response, imports: WebAssembly.Imports): Promise<InstantiatedContract>;
export declare function callSpacekitMain(ctx: HostContext, instance: WebAssembly.Instance, input: Uint8Array): {
    result: Uint8Array;
    status: number;
};
