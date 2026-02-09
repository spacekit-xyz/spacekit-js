/* tslint:disable */
/* eslint-disable */

export class QuantumVerkleWasm {
    free(): void;
    [Symbol.dispose](): void;
    create_multi_proof(addresses: Array<any>, keys: Array<any>): Uint8Array;
    create_proof(address_hex: string, key_hex: string): Uint8Array;
    get(address_hex: string, key_hex: string): any;
    constructor();
    root_hex(): string;
    set(address_hex: string, key_hex: string, value_hex: string, aux_hex?: string | null): void;
    verify_multi_proof(proof_bytes: Uint8Array, addresses: Array<any>, keys: Array<any>, values: Array<any>): boolean;
    verify_proof(proof_bytes: Uint8Array, address_hex: string, key_hex: string, value_hex: string): boolean;
}

export function setup_params(level: number, profile: number): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_quantumverklewasm_free: (a: number, b: number) => void;
    readonly quantumverklewasm_new: () => number;
    readonly quantumverklewasm_root_hex: (a: number) => [number, number];
    readonly quantumverklewasm_set: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => [number, number];
    readonly quantumverklewasm_get: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly quantumverklewasm_create_proof: (a: number, b: number, c: number, d: number, e: number) => [number, number, number];
    readonly quantumverklewasm_verify_proof: (a: number, b: any, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number];
    readonly quantumverklewasm_create_multi_proof: (a: number, b: any, c: any) => [number, number, number];
    readonly quantumverklewasm_verify_multi_proof: (a: number, b: any, c: any, d: any, e: any) => [number, number, number];
    readonly setup_params: (a: number, b: number) => [number, number, number];
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
