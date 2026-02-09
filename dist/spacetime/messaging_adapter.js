export class NoopMessagingAdapter {
    async send(_message) {
        // Intentionally no-op for local/dev environments.
    }
}
export class LocalMessagingAdapter {
    listeners = new Set();
    async send(message) {
        for (const listener of this.listeners) {
            listener(message);
        }
    }
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}
export class HttpMessagingAdapter {
    baseUrl;
    endpointPath;
    headers;
    conversationType;
    recipientDid;
    groupId;
    constructor(options) {
        this.baseUrl = options.baseUrl.replace(/\/$/, "");
        this.endpointPath = options.endpointPath ?? "/api/messages/envelope";
        this.headers = options.headers ?? {};
        this.conversationType = "direct";
    }
    async send(message) {
        const url = `${this.baseUrl}${this.endpointPath}`;
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                ...this.headers,
            },
            body: JSON.stringify({
                message,
                conversation_type: this.conversationType,
                recipient_did: this.recipientDid,
                group_id: this.groupId,
            }),
        });
        if (!res.ok) {
            throw new Error(`Messaging adapter failed: ${res.status}`);
        }
    }
    setDirectRecipient(did) {
        this.conversationType = "direct";
        this.recipientDid = did;
        this.groupId = undefined;
    }
    setGroupTarget(groupId) {
        this.conversationType = "group";
        this.groupId = groupId;
        this.recipientDid = undefined;
    }
}
