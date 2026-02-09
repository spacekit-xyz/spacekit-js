export type QuantumVerkleWasmModule = {
    default: (wasmUrl: string | URL | Uint8Array | ArrayBuffer) => Promise<void>;
    QuantumVerkleWasm: new () => {
        root_hex(): string;
        set(addressHex: string, keyHex: string, valueHex: string, auxHex?: string | null): void;
        get(addressHex: string, keyHex: string): string | null;
        create_proof(addressHex: string, keyHex: string): Uint8Array;
        verify_proof(proofBytes: Uint8Array, addressHex: string, keyHex: string, valueHex: string): boolean;
        create_multi_proof(addresses: string[], keys: string[]): Uint8Array;
        verify_multi_proof(proofBytes: Uint8Array, addresses: string[], keys: string[], values: string[]): boolean;
    };
    setup_params: (level: number, profile: number) => {
        paramsId: string;
        paramsBlobHex: string;
    };
};
export type QuantumVerkleWasmLoaderOptions = {
    wasmUrl?: string;
    moduleUrl?: string;
};
export declare function loadQuantumVerkleWasm(options?: QuantumVerkleWasmLoaderOptions): Promise<QuantumVerkleWasmModule>;
