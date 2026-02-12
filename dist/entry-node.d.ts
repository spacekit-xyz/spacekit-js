#!/usr/bin/env node
/**
 * SpaceKit Node.js Entry Point
 *
 * Starts a SpacekitVm instance with an HTTP JSON-RPC server.
 *
 * Usage:
 *   node dist/entry-node.js [--port 8747] [--host 127.0.0.1] [--chain-id spacekit-local]
 *
 * Environment variables:
 *   SPACEKIT_PORT       – HTTP port (default 8747)
 *   SPACEKIT_HOST       – Bind address (default 127.0.0.1)
 *   SPACEKIT_CHAIN_ID   – Chain identifier (default spacekit-local)
 *   SPACEKIT_API_KEY    – Optional API key for RPC auth
 *   SPACEKIT_DEV_MODE   – Set to "true" for dev mode (no signature checks)
 */
export {};
