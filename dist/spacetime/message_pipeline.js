import { createSpacekitMessage } from "./message.js";
import { routeSpaceTimeMessage } from "./router.js";
export async function ingestSpacekitTextMessage(rawText, context, options) {
    const { intent } = await options.classifier(rawText);
    if (intent === "spacekit_message") {
        return routeSpaceTimeMessage(rawText, options.classifier, options.spacetimeClient, context.did);
    }
    if (options.messagingAdapter) {
        const envelope = createSpacekitMessage("chat", rawText, context);
        await options.messagingAdapter.send(envelope);
        return { type: "chat_routed" };
    }
    return { type: "unhandled_intent", intent };
}
export async function ingestSpacekitEnvelope(envelope, options) {
    if (typeof envelope.payload === "string") {
        return ingestSpacekitTextMessage(envelope.payload, envelope.context, options);
    }
    if (options.messagingAdapter) {
        await options.messagingAdapter.send(envelope);
        return { type: "message_forwarded" };
    }
    return { type: "unhandled_payload" };
}
