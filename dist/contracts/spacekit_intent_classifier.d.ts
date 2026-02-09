import type { HostContext } from "../host.js";
export interface IntentClassifierResult {
    intent: string;
    confidence: number;
}
export declare class SpacekitIntentClassifierClient {
    private ctx;
    private instance;
    constructor(ctx: HostContext, instance: WebAssembly.Instance);
    classify(message: string): IntentClassifierResult;
    status(): string;
}
