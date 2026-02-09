import type { SpaceTimeClient } from "./client.js";
import type { SpacekitMessageEnvelope } from "./message.js";
export interface SpacekitMessageRouterOptions {
    spacetimeClient: SpaceTimeClient;
    onChatMessage?: (message: SpacekitMessageEnvelope) => Promise<unknown> | unknown;
    onSystemMessage?: (message: SpacekitMessageEnvelope) => Promise<unknown> | unknown;
}
export type SpacekitMessageRouterResult = {
    type: "spacetime_thread_created";
    threadId: number;
} | {
    type: "spacetime_reply_created";
    postId: number;
} | {
    type: "chat_routed";
    result?: unknown;
} | {
    type: "system_routed";
    result?: unknown;
} | {
    type: "error";
    message: string;
} | {
    type: "unhandled_kind";
    kind: string;
};
export declare function routeSpacekitMessage(message: SpacekitMessageEnvelope, options: SpacekitMessageRouterOptions): Promise<SpacekitMessageRouterResult>;
