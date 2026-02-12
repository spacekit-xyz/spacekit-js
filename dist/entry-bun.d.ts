#!/usr/bin/env bun
/**
 * SpaceKit Bun Entry Point
 *
 * Starts a SpacekitVm instance with both:
 *  - A Node-compatible HTTP JSON-RPC server (via node:http)
 *  - Optionally a native Bun.serve() server for better performance
 *
 * Usage:
 *   bun dist/entry-bun.js [--port 8747] [--host 127.0.0.1] [--chain-id spacekit-local]
 *
 * Environment variables:
 *   SPACEKIT_PORT       – HTTP port (default 8747)
 *   SPACEKIT_HOST       – Bind address (default 127.0.0.1)
 *   SPACEKIT_CHAIN_ID   – Chain identifier (default spacekit-local)
 *   SPACEKIT_API_KEY    – Optional API key for RPC auth
 *   SPACEKIT_DEV_MODE   – Set to "true" for dev mode (no signature checks)
 *   SPACEKIT_USE_BUN_SERVE – Set to "true" to use Bun.serve() instead of node:http
 */
export {};
