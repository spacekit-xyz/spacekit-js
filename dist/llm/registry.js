const adapterRegistry = new Map();
let activeAdapterId = null;
export function registerLlmAdapter(id, adapter, options = {}) {
    if (!options.overwrite && adapterRegistry.has(id)) {
        return false;
    }
    adapterRegistry.set(id, adapter);
    if (options.makeActive) {
        activeAdapterId = id;
    }
    return true;
}
export function unregisterLlmAdapter(id) {
    const existed = adapterRegistry.delete(id);
    if (activeAdapterId === id) {
        activeAdapterId = null;
    }
    return existed;
}
export function listLlmAdapters() {
    return Array.from(adapterRegistry.keys());
}
export function setActiveLlmAdapter(id) {
    if (!adapterRegistry.has(id)) {
        return null;
    }
    activeAdapterId = id;
    return adapterRegistry.get(id) ?? null;
}
export function getActiveLlmAdapter() {
    if (!activeAdapterId) {
        return null;
    }
    return adapterRegistry.get(activeAdapterId) ?? null;
}
