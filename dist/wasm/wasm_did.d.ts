/* tslint:disable */
/* eslint-disable */

export function slhDsa128sKeypair(): any;

export function slhDsa128sSign(private_key: Uint8Array, message: Uint8Array): Uint8Array;

export function slhDsa128sVerify(public_key: Uint8Array, message: Uint8Array, sig_bytes: Uint8Array): boolean;

export function slhDsa192sKeypair(): any;

export function slhDsa192sSign(private_key: Uint8Array, message: Uint8Array): Uint8Array;

export function slhDsa192sVerify(public_key: Uint8Array, message: Uint8Array, sig_bytes: Uint8Array): boolean;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly slhDsa128sKeypair: () => any;
    readonly slhDsa128sSign: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly slhDsa128sVerify: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly slhDsa192sKeypair: () => any;
    readonly slhDsa192sSign: (a: number, b: number, c: number, d: number) => [number, number, number, number];
    readonly slhDsa192sVerify: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number];
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
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
