/**
 * Proof Bridge: adapter interface and config for pushing SpaceKit proofs
 * to external chains (Ethereum, Bitcoin, Solana). See docs/PROOF_BRIDGE_DESIGN.md.
 */
/** Resolve env var references in chain config (e.g. privateKeyHex: "SPACEKIT_ETH_SIGNER_KEY"). */
export function substituteEnvInChainConfig(chainConfig) {
    const envVarPattern = /^[A-Z_][A-Z0-9_]*$/;
    const resolve = (v) => {
        if (v == null)
            return v;
        if (typeof v !== "string")
            return v;
        if (envVarPattern.test(v) && typeof process !== "undefined" && process.env?.[v] != null) {
            return process.env[v];
        }
        return v;
    };
    return {
        ...chainConfig,
        privateKeyHex: resolve(chainConfig.privateKeyHex) ?? chainConfig.privateKeyHex,
    };
}
/** Load chain configs from ProofBridgeConfig (inline or fetch from configUrl). Returns enabled chains only. */
export async function loadProofBridgeConfig(config) {
    let raw;
    if (config.source === "inline") {
        raw = config.chains;
    }
    else if (config.source === "url" && config.configUrl) {
        const res = await fetch(config.configUrl);
        if (!res.ok)
            throw new Error(`Proof bridge config fetch failed: ${res.status} ${res.statusText}`);
        const body = await res.json();
        raw = body.chains ?? body.bridgeConfig?.chains ?? body;
    }
    else {
        raw = undefined;
    }
    if (!raw || typeof raw !== "object")
        return [];
    const list = Object.values(raw).filter((c) => c?.enabled === true);
    return list.map(substituteEnvInChainConfig);
}
/** Create adapters from loaded chain configs. Requires optional adapter packages or in-repo adapters. */
export async function createAdaptersFromConfig(chainConfigs, options) {
    const registry = options?.adapterRegistry ?? getDefaultAdapterRegistry();
    const adapters = [];
    for (const cc of chainConfigs) {
        const adapter = await registry.create(cc);
        if (adapter)
            adapters.push(adapter);
    }
    return adapters;
}
let defaultRegistry = null;
/** Set the default adapter registry (used by createAdaptersFromConfig). Used by adapters/index to register Ethereum/Bitcoin/Solana. */
export function setDefaultAdapterRegistry(registry) {
    defaultRegistry = registry;
}
function getDefaultAdapterRegistry() {
    if (defaultRegistry)
        return defaultRegistry;
    return {
        async create(_config) {
            return null;
        },
    };
}
