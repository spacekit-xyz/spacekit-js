import { type SpacekitMessageContext } from "./message.js";
import type { SpacekitMessageEnvelope } from "./message.js";
import type { SpacekitMessagingAdapter } from "./messaging_adapter.js";
import type { SpaceTimeClient } from "./client.js";
export interface MessagePipelineOptions {
    classifier: (input: string) => Promise<{
        intent: string;
        confidence: number;
    }>;
    spacetimeClient: SpaceTimeClient;
    messagingAdapter?: SpacekitMessagingAdapter;
}
export declare function ingestSpacekitTextMessage(rawText: string, context: SpacekitMessageContext, options: MessagePipelineOptions): Promise<unknown>;
export declare function ingestSpacekitEnvelope(envelope: SpacekitMessageEnvelope, options: MessagePipelineOptions): Promise<unknown>;
