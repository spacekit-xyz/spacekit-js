import { StorageAdapter } from "./storage.js";
export interface TokenAdapter {
    balanceOf(did: string): bigint;
    transfer(from: string, to: string, amount: bigint): boolean;
    totalSupply(): bigint;
}
export interface NftAdapter {
    mint(contractId: string, owner: string): bigint;
    ownerOf(contractId: string, tokenId: bigint): string | null;
    transfer(contractId: string, tokenId: bigint, to: string): boolean;
}
export interface ReputationAdapter {
    getScore(did: string, repType: number): bigint;
    checkThreshold(did: string, repType: number, threshold: bigint): boolean;
    getOverall(did: string): bigint;
    getBreakdown(did: string): bigint[];
}
export interface FactAdapter {
    exists(packageId: string): boolean;
    verifyHash(packageId: string, hash: string): boolean;
}
export interface ContractCallResult {
    status: number;
    result: Uint8Array;
}
export interface ContractCallAdapter {
    call(contractId: string, input: Uint8Array, callerDid: string, value?: bigint): ContractCallResult;
}
export interface CompressionAdapter {
    compress(data: Uint8Array, mode: string): Uint8Array;
    decompress(data: Uint8Array, mode: string): Uint8Array;
}
/**
 * LLM status codes used by host functions
 */
export declare const LLM_STATUS: {
    readonly NOT_LOADED: 0;
    readonly READY: 1;
    readonly LOADING: 2;
};
export type LlmStatus = typeof LLM_STATUS[keyof typeof LLM_STATUS];
/**
 * Captured LLM request from contract execution (for two-phase inference)
 */
export interface CapturedLlmRequest {
    prompt: string;
    maxTokens: number;
    temperature: number;
}
/**
 * LLM Adapter interface for integrating language models with smart contracts.
 *
 * The infer method is synchronous because WASM host functions cannot be async.
 * Implementations should pre-load models and cache responses.
 *
 * Two-phase execution pattern (when using setCaptureMode):
 * 1. Contract runs in "capture mode" – llm_call records the prompt and returns a
 *    placeholder response (e.g. empty string) to the contract.
 * 2. Host runs async inference with the captured prompt.
 * 3. Contract runs again – llm_call returns the cached inference result.
 */
export interface LlmAdapter {
    /**
     * Run inference on a prompt. Must be synchronous.
     * @param prompt - The input prompt
     * @param maxTokens - Maximum tokens to generate
     * @param temperature - Sampling temperature (0-100, e.g., 70 = 0.7)
     * @returns The generated text, or empty string on failure
     */
    infer(prompt: string, maxTokens: number, temperature: number): string;
    /**
     * Get the current LLM status
     * @returns 0 = not loaded, 1 = ready, 2 = loading
     */
    getStatus(): LlmStatus;
    /**
     * Enable/disable capture mode for two-phase execution.
     * In capture mode, infer() records the request but returns empty string.
     */
    setCaptureMode?(enabled: boolean): void;
    /**
     * Get the captured LLM request from the last capture-mode execution.
     */
    getCapturedRequest?(): CapturedLlmRequest | null;
    /**
     * Clear any captured request.
     */
    clearCapturedRequest?(): void;
}
export interface Logger {
    log(message: string): void;
}
export interface HostOptions {
    storage?: StorageAdapter;
    token?: TokenAdapter;
    nft?: NftAdapter;
    reputation?: ReputationAdapter;
    fact?: FactAdapter;
    compression?: CompressionAdapter;
    llm?: LlmAdapter;
    logger?: Logger;
    callerDid?: string;
    contractCall?: ContractCallAdapter;
}
export interface HostContext {
    setMemory(memory: WebAssembly.Memory): void;
    readBytes(ptr: number, len: number): Uint8Array;
    writeBytes(ptr: number, data: Uint8Array): void;
    readString(ptr: number, len: number): string;
    writeString(ptr: number, value: string): number;
    alloc(size: number): number;
    events: Array<{
        type: string;
        data: Uint8Array;
    }>;
    callerDid: string;
    msgValue: bigint;
    gasUsed: number;
    gasLimit: number;
    setGasLimit(limit: number): void;
    consumeGas(amount: number): void;
    contractId?: string;
    contractCall?: ContractCallAdapter;
}
declare class HostContextImpl implements HostContext {
    private memoryView;
    private allocator;
    storage: StorageAdapter;
    token: TokenAdapter;
    nft: NftAdapter;
    reputation: ReputationAdapter;
    fact: FactAdapter;
    compression: CompressionAdapter;
    llm: LlmAdapter;
    logger: Logger;
    callerDid: string;
    contractId?: string;
    contractCall?: ContractCallAdapter;
    msgValue: bigint;
    events: Array<{
        type: string;
        data: Uint8Array;
    }>;
    gasUsed: number;
    gasLimit: number;
    private llmResponse;
    constructor(options: HostOptions);
    setMemory(memory: WebAssembly.Memory): void;
    readBytes(ptr: number, len: number): Uint8Array;
    writeBytes(ptr: number, data: Uint8Array): void;
    readString(ptr: number, len: number): string;
    writeString(ptr: number, value: string): number;
    alloc(size: number): number;
    setGasLimit(limit: number): void;
    consumeGas(amount: number): void;
    setLlmResponse(value: string): void;
    getLlmResponse(): string;
}
export declare function createHost(options?: HostOptions): {
    context: HostContextImpl;
    imports: WebAssembly.Imports;
    bindInstance(instance: WebAssembly.Instance): void;
};
export declare function createImports(ctx: HostContextImpl): WebAssembly.Imports;
export { HostContextImpl };
