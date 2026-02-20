/**
 * WASM loader for SLH-DSA (FIPS-205 / SPHINCS+) quantum-resistant signatures.
 *
 * Mirrors the loadQuantumVerkleWasm pattern.  The WASM module exposes:
 *   - slhDsa128sKeypair / slhDsa128sSign / slhDsa128sVerify
 *   - slhDsa192sKeypair / slhDsa192sSign / slhDsa192sVerify
 */
let cachedModule = null;
export async function loadQuantumDidWasm(options = {}) {
    if (cachedModule) {
        return cachedModule;
    }
    cachedModule = (async () => {
        const isNode = typeof process !== "undefined" && Boolean(process.versions?.node);
        const resolveUrl = (input, fallbackRelative) => {
            if (!input) {
                return new URL(fallbackRelative, import.meta.url).toString();
            }
            if (input.startsWith("http://") || input.startsWith("https://") || input.startsWith("file:")) {
                return input;
            }
            if (input.startsWith("/")) {
                if (typeof window !== "undefined" && window.location?.origin) {
                    return new URL(input, window.location.origin).toString();
                }
                return input;
            }
            return input;
        };
        const moduleUrl = resolveUrl(options.moduleUrl, "../wasm/wasm_did.js");
        const wasmUrl = resolveUrl(options.wasmUrl, "../wasm/wasm_did_bg.wasm");
        const isBrowser = !isNode && typeof window !== "undefined";
        const loadModule = async (url) => {
            if (!isBrowser || url.startsWith("file:")) {
                return (await import(/* @vite-ignore */ url));
            }
            if (url.startsWith("/") || url.startsWith("http://") || url.startsWith("https://")) {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to fetch wasm-did module: ${response.status} ${response.statusText}`);
                }
                const code = await response.text();
                const blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
                try {
                    return (await import(/* @vite-ignore */ blobUrl));
                }
                finally {
                    URL.revokeObjectURL(blobUrl);
                }
            }
            return (await import(/* @vite-ignore */ url));
        };
        const mod = await loadModule(moduleUrl);
        if (isNode) {
            const { readFile } = await import("node:fs/promises");
            const { fileURLToPath } = await import("node:url");
            const wasmPath = wasmUrl.startsWith("file:") ? fileURLToPath(wasmUrl) : wasmUrl;
            const wasmBytes = await readFile(wasmPath);
            await mod.default(wasmBytes);
        }
        else {
            if (wasmUrl.startsWith("/") || wasmUrl.startsWith("http://") || wasmUrl.startsWith("https://")) {
                const response = await fetch(wasmUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch wasm-did bytes: ${response.status} ${response.statusText}`);
                }
                const wasmBytes = await response.arrayBuffer();
                await mod.default(wasmBytes);
            }
            else {
                await mod.default(wasmUrl);
            }
        }
        return mod;
    })();
    return cachedModule;
}
