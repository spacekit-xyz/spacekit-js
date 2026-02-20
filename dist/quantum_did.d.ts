/**
 * WASM loader for SLH-DSA (FIPS-205 / SPHINCS+) quantum-resistant signatures.
 *
 * Mirrors the loadQuantumVerkleWasm pattern.  The WASM module exposes:
 *   - slhDsa128sKeypair / slhDsa128sSign / slhDsa128sVerify
 *   - slhDsa192sKeypair / slhDsa192sSign / slhDsa192sVerify
 */
export type SlhDsaKeypair = {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
    algorithm: string;
    publicKeySize: number;
    signatureSize: number;
};
export type QuantumDidWasmModule = {
    default: (wasmUrl: string | URL | Uint8Array | ArrayBuffer) => Promise<void>;
    slhDsa128sKeypair: () => SlhDsaKeypair;
    slhDsa128sSign: (privateKey: Uint8Array, message: Uint8Array) => Uint8Array;
    slhDsa128sVerify: (publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array) => boolean;
    slhDsa192sKeypair: () => SlhDsaKeypair;
    slhDsa192sSign: (privateKey: Uint8Array, message: Uint8Array) => Uint8Array;
    slhDsa192sVerify: (publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array) => boolean;
};
export type QuantumDidWasmLoaderOptions = {
    wasmUrl?: string;
    moduleUrl?: string;
};
export declare function loadQuantumDidWasm(options?: QuantumDidWasmLoaderOptions): Promise<QuantumDidWasmModule>;
