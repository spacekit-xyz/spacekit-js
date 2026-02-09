import { type LlmAdapter, type LlmStatus, type CapturedLlmRequest } from "../host.js";
export type LlmChatMessage = {
    role: "user" | "assistant" | "system";
    content: string;
};
export interface LlmChatEngine {
    chat: {
        completions: {
            create: (params: {
                messages: LlmChatMessage[];
                stream?: boolean;
                temperature?: number;
                max_tokens?: number;
            }) => Promise<{
                choices: Array<{
                    message: {
                        content: string;
                    };
                }>;
            }>;
        };
    };
    unload?: () => Promise<void>;
}
/**
 * TRM (Tiny Recursive Model) configuration for recursive reasoning.
 * Enables small models to achieve better results through multi-step refinement.
 */
export interface TRMConfig {
    /** Maximum reasoning steps (default: 3) */
    maxSteps: number;
    /** Enable chain-of-thought prompting (default: true) */
    chainOfThought: boolean;
    /** Enable self-verification step (default: true) */
    selfVerify: boolean;
    /** Memory buffer size for context accumulation (default: 2048 chars) */
    memoryBufferSize: number;
    /** Temperature decay per step (multiplier, default: 0.9) */
    temperatureDecay: number;
    /** Confidence threshold to stop early (0-1, default: 0.8) */
    confidenceThreshold: number;
}
/**
 * Cached LLM adapter with TRM (Tiny Recursive Model) support.
 * Applies recursive reasoning to improve small model outputs.
 * Precompute must be called before contract execution.
 */
export declare class WebLlmAdapter implements LlmAdapter {
    private engine;
    private status;
    private cachedResponse;
    private trmConfig;
    private reasoningMemory;
    private captureMode;
    private capturedRequest;
    setEngine(engine: LlmChatEngine | null): void;
    getEngine(): LlmChatEngine | null;
    setStatus(status: LlmStatus): void;
    getStatus(): LlmStatus;
    /**
     * Enable/disable capture mode for two-phase contract execution.
     * In capture mode, infer() records the contract's prompt/params but returns empty.
     */
    setCaptureMode(enabled: boolean): void;
    /**
     * Get the captured LLM request from the last capture-mode execution.
     */
    getCapturedRequest(): CapturedLlmRequest | null;
    /**
     * Clear any captured request.
     */
    clearCapturedRequest(): void;
    /**
     * Configure TRM recursive reasoning parameters.
     */
    setTRMConfig(config: Partial<TRMConfig>): void;
    getTRMConfig(): TRMConfig;
    /**
     * Clear reasoning memory between tasks.
     */
    clearMemory(): void;
    /**
     * Standard single-pass inference (for simple queries).
     * Splits the contract prompt into system/user roles so small models
     * don't echo system instructions back as content.
     */
    precompute(prompt: string, maxTokens: number, temperature: number): Promise<string>;
    /**
     * TRM-enhanced recursive reasoning for complex tasks.
     * Runs multiple refinement passes to improve output quality.
     */
    precomputeTRM(prompt: string, maxTokens: number, temperature: number, config?: Partial<TRMConfig>): Promise<{
        response: string;
        steps: number;
        confidence: number;
    }>;
    /**
     * Extract the user's actual question from a contract prompt.
     * Contract prompts wrap user input in system instructions, e.g.:
     *   "You are Kit, a helpful AI assistant...\n\nUser: What are derivatives?\n\nKit:"
     * This extracts "What are derivatives?" so TRM refinement steps don't
     * re-inject the system instructions.
     */
    private extractUserQuestion;
    /**
     * Extract system instructions from a contract prompt.
     * Returns the text before "User:" / "USER:" / "Content:", or null if
     * no structured prompt is detected.
     */
    private extractSystemInstructions;
    /**
     * Compute rough similarity between two strings (0-1).
     */
    private computeSimilarity;
    infer(prompt: string, maxTokens: number, temperature: number): string;
}
