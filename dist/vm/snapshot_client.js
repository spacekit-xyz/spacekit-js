import { sha256Hex } from "./hash.js";
export async function fetchStateSnapshot(url, fetcher = fetch) {
    const response = await fetcher(url);
    if (!response.ok) {
        throw new Error(`Snapshot fetch failed with ${response.status}`);
    }
    const payload = await response.json();
    if (typeof payload?.height !== "number" ||
        typeof payload?.stateRoot !== "string" ||
        !Array.isArray(payload?.chunks)) {
        throw new Error("Invalid snapshot format");
    }
    return {
        height: payload.height,
        stateRoot: payload.stateRoot,
        quantumStateRoot: typeof payload.quantumStateRoot === "string" ? payload.quantumStateRoot : undefined,
        createdAt: typeof payload.createdAt === "number" ? payload.createdAt : Date.now(),
        chunks: payload.chunks.map((chunk) => ({
            id: chunk.id,
            hash: chunk.hash,
        })),
    };
}
export function verifySnapshotAgainstHeader(snapshot, header) {
    if (!header)
        return false;
    const stateOk = snapshot.height === header.height && snapshot.stateRoot === header.stateRoot;
    if (!stateOk) {
        return false;
    }
    if (snapshot.quantumStateRoot && header.quantumStateRoot) {
        return snapshot.quantumStateRoot === header.quantumStateRoot;
    }
    return true;
}
export async function fetchSnapshotChunk(url, fetcher = fetch) {
    const response = await fetcher(url);
    if (!response.ok) {
        throw new Error(`Chunk fetch failed with ${response.status}`);
    }
    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
}
export async function verifySnapshotChunks(snapshotUrl, snapshot, baseUrl, fetcher = fetch, onProgress) {
    const resolvedBase = baseUrl ??
        (() => {
            const url = new URL(snapshotUrl);
            url.pathname = url.pathname.replace(/\/[^/]*$/, "");
            return url.toString().replace(/\/$/, "");
        })();
    let verified = 0;
    for (const chunk of snapshot.chunks) {
        const chunkUrl = `${resolvedBase}/chunks/${encodeURIComponent(chunk.id)}`;
        const bytes = await fetchSnapshotChunk(chunkUrl, fetcher);
        const hash = await sha256Hex(bytes);
        if (hash !== chunk.hash) {
            throw new Error(`Chunk hash mismatch: ${chunk.id}`);
        }
        verified += 1;
        onProgress?.(verified, snapshot.chunks.length, chunk.id);
    }
    return { verified, total: snapshot.chunks.length };
}
export async function verifySnapshotChunksResumable(snapshotUrl, snapshot, options = {}) {
    const { baseUrl, fetcher = fetch, startIndex = 0, retries = 2, backoffMs = 250, onProgress, } = options;
    const resolvedBase = baseUrl ??
        (() => {
            const url = new URL(snapshotUrl);
            url.pathname = url.pathname.replace(/\/[^/]*$/, "");
            return url.toString().replace(/\/$/, "");
        })();
    let verified = 0;
    for (let i = startIndex; i < snapshot.chunks.length; i += 1) {
        const chunk = snapshot.chunks[i];
        const chunkUrl = `${resolvedBase}/chunks/${encodeURIComponent(chunk.id)}`;
        let attempt = 0;
        let ok = false;
        while (attempt <= retries && !ok) {
            try {
                const bytes = await fetchSnapshotChunk(chunkUrl, fetcher);
                const hash = await sha256Hex(bytes);
                if (hash !== chunk.hash) {
                    throw new Error(`Chunk hash mismatch: ${chunk.id}`);
                }
                ok = true;
            }
            catch (error) {
                attempt += 1;
                if (attempt > retries) {
                    throw error;
                }
                const delay = backoffMs * Math.pow(2, attempt - 1);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        verified += 1;
        onProgress?.(verified + startIndex, snapshot.chunks.length, chunk.id);
    }
    return { verified: verified + startIndex, total: snapshot.chunks.length };
}
function decodeSnapshotChunk(bytes) {
    const text = new TextDecoder().decode(bytes);
    const normalizeEntry = (entry) => {
        if (!entry || typeof entry.keyHex !== "string" || typeof entry.valueHex !== "string") {
            return null;
        }
        return { keyHex: entry.keyHex, valueHex: entry.valueHex };
    };
    try {
        const payload = JSON.parse(text);
        if (Array.isArray(payload)) {
            return payload.map(normalizeEntry).filter(Boolean);
        }
        if (Array.isArray(payload?.entries)) {
            return payload.entries.map(normalizeEntry).filter(Boolean);
        }
    }
    catch {
        // fallback to newline-delimited JSON
    }
    const entries = [];
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        const entry = normalizeEntry(JSON.parse(trimmed));
        if (entry) {
            entries.push(entry);
        }
    }
    if (!entries.length) {
        throw new Error("Snapshot chunk decode failed");
    }
    return entries;
}
export async function downloadStateSnapshot(snapshotUrl, snapshot, options = {}) {
    const { baseUrl, fetcher = fetch, startIndex = 0, retries = 2, backoffMs = 250, onProgress, verify = true, parseChunk = decodeSnapshotChunk, onChunkEntries, } = options;
    const resolvedBase = baseUrl ??
        (() => {
            const url = new URL(snapshotUrl);
            url.pathname = url.pathname.replace(/\/[^/]*$/, "");
            return url.toString().replace(/\/$/, "");
        })();
    const entries = [];
    for (let i = startIndex; i < snapshot.chunks.length; i += 1) {
        const chunk = snapshot.chunks[i];
        const chunkUrl = `${resolvedBase}/chunks/${encodeURIComponent(chunk.id)}`;
        let attempt = 0;
        let ok = false;
        while (attempt <= retries && !ok) {
            try {
                const bytes = await fetchSnapshotChunk(chunkUrl, fetcher);
                if (verify) {
                    const hash = await sha256Hex(bytes);
                    if (hash !== chunk.hash) {
                        throw new Error(`Chunk hash mismatch: ${chunk.id}`);
                    }
                }
                const decoded = parseChunk(bytes);
                entries.push(...decoded);
                onChunkEntries?.(decoded, chunk.id);
                ok = true;
            }
            catch (error) {
                attempt += 1;
                if (attempt > retries) {
                    throw error;
                }
                const delay = backoffMs * Math.pow(2, attempt - 1);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        onProgress?.(i + 1, snapshot.chunks.length, chunk.id);
    }
    entries.sort((a, b) => a.keyHex.localeCompare(b.keyHex));
    return {
        stateRoot: snapshot.stateRoot,
        entries,
        timestamp: snapshot.createdAt ?? Date.now(),
    };
}
export async function downloadStateSnapshotDelta(snapshotUrl, snapshot, options = {}) {
    const { baseUrl, fetcher = fetch, retries = 2, backoffMs = 250, verify = true, parseChunk = decodeSnapshotChunk, onChunkEntries, knownChunkIds = [], } = options;
    const resolvedBase = baseUrl ??
        (() => {
            const url = new URL(snapshotUrl);
            url.pathname = url.pathname.replace(/\/[^/]*$/, "");
            return url.toString().replace(/\/$/, "");
        })();
    const known = new Set(knownChunkIds);
    const entries = [];
    let fetched = 0;
    let skipped = 0;
    for (const chunk of snapshot.chunks) {
        if (known.has(chunk.id)) {
            skipped += 1;
            continue;
        }
        const chunkUrl = `${resolvedBase}/chunks/${encodeURIComponent(chunk.id)}`;
        let attempt = 0;
        let ok = false;
        while (attempt <= retries && !ok) {
            try {
                const bytes = await fetchSnapshotChunk(chunkUrl, fetcher);
                if (verify) {
                    const hash = await sha256Hex(bytes);
                    if (hash !== chunk.hash) {
                        throw new Error(`Chunk hash mismatch: ${chunk.id}`);
                    }
                }
                const decoded = parseChunk(bytes);
                entries.push(...decoded);
                onChunkEntries?.(decoded, chunk.id);
                ok = true;
                fetched += 1;
            }
            catch (error) {
                attempt += 1;
                if (attempt > retries) {
                    throw error;
                }
                const delay = backoffMs * Math.pow(2, attempt - 1);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
    }
    entries.sort((a, b) => a.keyHex.localeCompare(b.keyHex));
    return { entries, fetched, skipped };
}
