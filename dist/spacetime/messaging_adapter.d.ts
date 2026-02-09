import type { SpacekitMessageEnvelope } from "./message.js";
export interface SpacekitMessagingAdapter {
    send(message: SpacekitMessageEnvelope): Promise<void>;
}
export interface HttpMessagingAdapterOptions {
    baseUrl: string;
    endpointPath?: string;
    headers?: Record<string, string>;
}
export type MessageListener = (message: SpacekitMessageEnvelope) => void;
export declare class NoopMessagingAdapter implements SpacekitMessagingAdapter {
    send(_message: SpacekitMessageEnvelope): Promise<void>;
}
export declare class LocalMessagingAdapter implements SpacekitMessagingAdapter {
    private listeners;
    send(message: SpacekitMessageEnvelope): Promise<void>;
    subscribe(listener: MessageListener): () => void;
}
export declare class HttpMessagingAdapter implements SpacekitMessagingAdapter {
    private baseUrl;
    private endpointPath;
    private headers;
    private conversationType;
    private recipientDid?;
    private groupId?;
    constructor(options: HttpMessagingAdapterOptions);
    send(message: SpacekitMessageEnvelope): Promise<void>;
    setDirectRecipient(did: string): void;
    setGroupTarget(groupId: string): void;
}
