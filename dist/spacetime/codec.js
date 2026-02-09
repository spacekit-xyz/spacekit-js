export const SpaceTimeJsonCodec = {
    encode(method, args) {
        const payload = JSON.stringify({ method, args });
        return new TextEncoder().encode(payload);
    },
    decode(_method, output) {
        if (!output || output.length === 0) {
            return undefined;
        }
        const text = new TextDecoder().decode(output);
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    },
};
