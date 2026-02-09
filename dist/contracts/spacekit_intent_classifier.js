import { callSpacekitMain } from "../runtime.js";
const OP_CLASSIFY = 1;
const OP_STATUS = 2;
function concat(parts) {
    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}
function encodeU16(value) {
    const buf = new ArrayBuffer(2);
    new DataView(buf).setUint16(0, value, true);
    return new Uint8Array(buf);
}
function encodeString(value) {
    const data = new TextEncoder().encode(value);
    return concat([encodeU16(data.length), data]);
}
function decodeString(bytes) {
    return new TextDecoder().decode(bytes);
}
export class SpacekitIntentClassifierClient {
    ctx;
    instance;
    constructor(ctx, instance) {
        this.ctx = ctx;
        this.instance = instance;
    }
    classify(message) {
        const payload = concat([Uint8Array.of(OP_CLASSIFY), encodeString(message)]);
        const { status, result } = callSpacekitMain(this.ctx, this.instance, payload);
        if (status <= 0) {
            return { intent: "ask_unknown", confidence: 0 };
        }
        const text = decodeString(result);
        try {
            const parsed = JSON.parse(text);
            return parsed;
        }
        catch {
            return { intent: "ask_unknown", confidence: 0 };
        }
    }
    status() {
        const payload = Uint8Array.of(OP_STATUS);
        const { status, result } = callSpacekitMain(this.ctx, this.instance, payload);
        if (status <= 0) {
            return "unknown";
        }
        return decodeString(result);
    }
}
