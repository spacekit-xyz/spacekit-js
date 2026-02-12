/**
 * Platform detection and runtime polyfill setup for SpaceKit.
 *
 * Supports three deployment targets:
 *  - Browser (default, no setup needed)
 *  - Node.js (requires `fake-indexeddb` polyfill for IndexedDB)
 *  - Bun (requires `fake-indexeddb` polyfill for IndexedDB)
 */
export type SpacekitRuntime = "browser" | "node" | "bun";
/**
 * Detect the current JavaScript runtime.
 */
export declare function detectRuntime(): SpacekitRuntime;
/**
 * Returns true when running outside a browser (Node.js or Bun).
 */
export declare function isServerRuntime(): boolean;
/**
 * Install required polyfills for server-side runtimes.
 *
 * Currently this installs a spec-compliant IndexedDB implementation
 * (`fake-indexeddb`) into the global scope so that all SpaceKit
 * storage adapters work without modification.
 *
 * Safe to call multiple times – subsequent calls are a no-op.
 * Safe to call in the browser – detects the environment and skips.
 */
export declare function installPolyfills(): Promise<void>;
/**
 * Reset polyfill state (for testing purposes).
 */
export declare function resetPolyfillState(): void;
