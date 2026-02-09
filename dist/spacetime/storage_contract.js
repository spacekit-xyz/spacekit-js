function hexToBytes(hex) {
    const clean = hex.length % 2 === 0 ? hex : `0${hex}`;
    const out = new Uint8Array(clean.length / 2);
    for (let i = 0; i < out.length; i += 1) {
        out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    }
    return out;
}
function bytesToHex(bytes) {
    let out = "";
    for (const b of bytes) {
        out += b.toString(16).padStart(2, "0");
    }
    return out;
}
function decodeValueHex(valueHex) {
    if (!valueHex)
        return null;
    try {
        const decoded = new TextDecoder().decode(hexToBytes(valueHex));
        return JSON.parse(decoded);
    }
    catch {
        return null;
    }
}
function encodePayload(payload) {
    return bytesToHex(new TextEncoder().encode(JSON.stringify(payload ?? null)));
}
function extractThread(payload) {
    const data = payload?.thread ?? payload;
    if (!data || typeof data.id !== "number")
        return null;
    return {
        id: data.id,
        title: data.title ?? "",
        authorDid: data.author_did ?? "",
        createdAt: data.created_at ?? Date.now(),
        contentRef: data.content_ref ?? undefined,
    };
}
function extractPost(payload) {
    const data = payload?.post ?? payload;
    if (!data || typeof data.id !== "number")
        return null;
    return {
        id: data.id,
        threadId: data.thread_id ?? 0,
        parentPostId: data.parent_post_id ?? null,
        authorDid: data.author_did ?? "",
        createdAt: data.created_at ?? Date.now(),
        contentRef: data.content_ref ?? "",
    };
}
function extractProfile(payload) {
    const data = payload?.profile ?? payload;
    if (!data || !data.did)
        return null;
    return {
        did: data.did,
        name: data.name ?? "",
        model: data.model ?? "",
        metadataRef: data.metadata_ref ?? undefined,
        registeredAt: data.registered_at ?? Date.now(),
    };
}
async function listDocuments(storage, collection) {
    const docs = await storage.listDocuments?.(collection);
    return (docs ?? []);
}
export function createSpaceTimeStorageContractCaller(options) {
    const collection = options.collection ?? "spacetime";
    const callerDid = options.callerDid;
    const storage = options.storage;
    return async function callContract(_address, method, args) {
        const docs = await listDocuments(storage, collection);
        const parsed = docs
            .map((doc) => decodeValueHex(doc.data?.value_hex))
            .filter(Boolean);
        const threads = parsed
            .map((payload) => extractThread(payload))
            .filter(Boolean);
        const posts = parsed
            .map((payload) => extractPost(payload))
            .filter(Boolean);
        const profiles = parsed
            .map((payload) => extractProfile(payload))
            .filter(Boolean);
        switch (method) {
            case "list_threads": {
                const [offset = 0, limit = 50] = args;
                return threads.slice(offset, offset + limit);
            }
            case "list_posts": {
                const [threadId, offset = 0, limit = 50] = args;
                return posts
                    .filter((post) => post.threadId === threadId)
                    .slice(offset, offset + limit);
            }
            case "get_thread": {
                const [threadId] = args;
                return (threads.find((t) => t.id === threadId) ?? null);
            }
            case "get_post": {
                const [postId] = args;
                return (posts.find((p) => p.id === postId) ?? null);
            }
            case "get_profile": {
                const [did] = args;
                return (profiles.find((p) => p.did === did) ?? null);
            }
            case "is_agent": {
                const [did] = args;
                return profiles.some((p) => p.did === did);
            }
            case "create_thread": {
                const [title, contentRef] = args;
                const nextId = (threads.map((t) => t.id).sort((a, b) => b - a)[0] ?? 0) + 1;
                const thread = {
                    id: nextId,
                    title,
                    author_did: callerDid,
                    content_ref: contentRef,
                    created_at: Date.now(),
                };
                await storage.putDocument?.(collection, `thread:${nextId}`, {
                    value_hex: encodePayload(thread),
                    updated_at: Date.now(),
                });
                return nextId;
            }
            case "reply": {
                const [threadId, parentPostId, contentRef] = args;
                const nextId = (posts.map((p) => p.id).sort((a, b) => b - a)[0] ?? 0) + 1;
                const post = {
                    id: nextId,
                    thread_id: threadId,
                    parent_post_id: parentPostId ?? null,
                    author_did: callerDid,
                    content_ref: contentRef,
                    created_at: Date.now(),
                };
                await storage.putDocument?.(collection, `post:${nextId}`, {
                    value_hex: encodePayload(post),
                    updated_at: Date.now(),
                });
                return nextId;
            }
            default:
                throw new Error(`Unsupported method: ${method}`);
        }
    };
}
