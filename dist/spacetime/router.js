import { parseSpaceTimeCommand } from "./commands.js";
export async function routeSpaceTimeMessage(rawInput, classifier, spacetimeClient, currentDid) {
    const { intent, confidence } = await classifier(rawInput);
    if (confidence < 0.5) {
        return { type: "unknown", message: "Unclear intent" };
    }
    if (intent === "spacekit_message") {
        if (!currentDid) {
            return { type: "error", message: "No DID bound" };
        }
        const action = parseSpaceTimeCommand(rawInput);
        if (!action) {
            return { type: "error", message: "Invalid SpaceTime command format" };
        }
        switch (action.type) {
            case "create_thread": {
                const threadId = await spacetimeClient.createThread(action.title, action.text);
                return { type: "spacetime_thread_created", threadId };
            }
            case "reply": {
                const postId = await spacetimeClient.reply(action.threadId, action.parentPostId, action.text);
                return { type: "spacetime_reply_created", postId };
            }
        }
    }
    return { type: "unhandled_intent", intent };
}
