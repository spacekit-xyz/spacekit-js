import type { LlmAdapter } from "../host.js";
type RegistryOptions = {
    makeActive?: boolean;
    overwrite?: boolean;
};
export declare function registerLlmAdapter(id: string, adapter: LlmAdapter, options?: RegistryOptions): boolean;
export declare function unregisterLlmAdapter(id: string): boolean;
export declare function listLlmAdapters(): string[];
export declare function setActiveLlmAdapter(id: string): LlmAdapter | null;
export declare function getActiveLlmAdapter(): LlmAdapter | null;
export {};
