import type { SpaceTimeClient } from "./client.js";
export interface ClassifierResult {
    intent: string;
    confidence: number;
}
export declare function routeSpaceTimeMessage(rawInput: string, classifier: (input: string) => Promise<ClassifierResult>, spacetimeClient: SpaceTimeClient, currentDid: string | null): Promise<{
    type: "unknown";
    message: string;
} | {
    type: "error";
    message: string;
} | {
    type: "spacetime_thread_created";
    threadId: number;
} | {
    type: "spacetime_reply_created";
    postId: number;
} | {
    type: "unhandled_intent";
    intent: string;
}>;
