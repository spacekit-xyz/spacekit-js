# SpaceKitJS Technical Whitepaper v1.0
_SpaceKit Compute Node · Browser VM & Host SDK_

**Version:** 1.0  
**Date:** January 2026  
**Project:** `@spacekit/spacekit-js`  
---

## Executive Summary
SpaceKitJS is a browser‑native virtual machine (VM) and host SDK for executing SpaceKit
WASM smart contracts. It provides deterministic execution, local state, JSON‑RPC + EIP‑1193
compatibility, and optional sync to decentralized infrastructure. It also includes a
light‑client toolkit for header sync, snapshot verification, and proof validation. SpaceKitJS
enables developers to run production‑grade smart contracts entirely in the browser while
maintaining cryptographic integrity, auditability, and interoperability with compute,
storage, and messaging nodes.
Quantum Verkle integration adds a post‑quantum, vector‑commitment‑based state root and
stateless proof verification path anchored to block headers.

---

## 1. Problem Statement
Most smart contract runtimes are server‑first and not optimized for browser execution.
This creates friction for rapid prototyping, client‑side verification, and offline/edge usage.
SpaceKitJS addresses:
- Browser‑first execution of WASM contracts
- Deterministic host ABI across environments
- Local chain state with portable rollups and proofs
- Secure sync to decentralized storage nodes

---

## 2. System Overview
SpaceKitJS is built around:
- **SpacekitVM**: A WASM runtime for contracts
- **Host ABI**: Deterministic imports (`env`, `spacekit_storage`, `spacekit_llm`, `spacekit_messaging`, etc.)
- **Sequencer**: Rollup bundling, export, and proof support
- **JSON‑RPC + EIP‑1193**: Dapp compatibility and extension wallet integration
- **Header Sync Client**: Fetch, validate, and cache block headers
- **Snapshot + Proof Tools**: Verify state snapshots and receipt/state proofs
- **Quantum Verkle**: Post‑quantum state root + proofs via WASM

Key differentiator: **fully browser‑native execution** with the same ABI used to execute smart contracts on compute nodes.

---

## 3. Architecture
### 3.1 Core Components
- **SpacekitVM**: deploy/execute/mine lifecycle, block headers, receipts
- **Host Runtime**: provides deterministic host functions, storage, and logging
- **Storage Adapters**:
  - IndexedDB (local persistence)
  - StorageNodeAdapter (decentralized sync)
- **Header Sync**: RPC header fetch + IndexedDB cache
- **Snapshot Client**: chunked downloads, hash verification, resumable progress
- **P2P Playground Client**: WebRTC + WS signaling for peer exchange and validation
- **Quantum Verkle Bridge**: WASM loader + proof generation/verification

### 3.2 Execution Lifecycle
1. Deploy WASM contract
2. Submit transaction
3. Execute contract
4. Mine block
5. Compute Merkle roots + Quantum Verkle state root
6. Persist receipts, events, proofs
7. (Optional) Export rollup bundle + proofs to compute node

---

## 4. Host ABI and Contract Model
Contracts use `wasm32-unknown-unknown` and rely on the SpaceKit Host ABI:
- `env` (core utilities, msg_value, caller DID)
- `spacekit_storage`
- `sk_erc20`, `sk_erc721`
- `spacekit_reputation`, `spacekit_fact`
- `spacekit_llm`
- `spacekit_messaging`

ABI versioning ensures deterministic execution across browser and compute nodes.

---

## 5. VM API Surface
Core API:
- `deployContract(wasm)`
- `submitTransaction(contractId, input, did)`
- `mineBlock()`

Optional controls:
- Auto‑miner (`startAutoMiner`)
- Rollup bundling (`SpacekitSequencer`)
- Proof generation (`txProof`, `receiptProof`, `stateProof`)
- Quantum Verkle proofs (`computeQuantumStateRoot`, `getQuantumStateProof`)
- Block import (`importBlocks`) for blockstore injection and replay

---

## 6. Storage & Synchronization
SpaceKitJS supports local persistence and remote sync:
- **IndexedDB**: fast local persistence
- **Storage Node Sync**: optional remote archival and sharing
- **Conflict Resolution**: LWW (last‑write‑wins)
- **Header Cache**: IndexedDB header cache keyed by chainId
- **Snapshot Progress**: resumable snapshot verification via IndexedDB

This enables browser‑native chains with portability across devices and nodes.
Quantum Verkle enables stateless verification of key/value proofs against
`BlockHeader.quantumStateRoot` without requiring full state download.

---

## 7. JSON‑RPC + EIP‑1193 Compatibility
SpaceKitJS supports:
- JSON‑RPC for VM operations
  - `vm_deploy`, `vm_submit`, `vm_execute`, `vm_mine`
  - `vm_txProof`, `vm_receiptProof`, `vm_stateProof`
  - `vm_quantumStateRoot`, `vm_quantumStateProof`
- JSON‑RPC for sync
  - `vm_headers`, `vm_header`, `vm_snapshot`, `vm_stateProof`
- EIP‑1193 bridge for wallet integration

This provides compatibility with existing dapp tooling.

---

## 8. Security Model
### 8.1 Signing
- Ed25519 by default
- Post-quantum signing optional (SPHINCS+)

### 8.2 Determinism
Strict ABI + deterministic execution prevents divergence.

### 8.3 Wallet Security
Extension wallet encrypts keys with PBKDF2 + AES‑GCM.

### 8.4 Header Integrity
Headers can include signer metadata and signatures; clients verify signatures when metadata is present.
Quantum Verkle roots are embedded in headers to anchor stateless proofs to authenticated chain state.

---

## 9. AI & LLM Integration
SpaceKitJS exposes `spacekit_llm` host functions for contract‑bound inference.
The current async/sync bridge uses precompute caching to safely provide LLM results
to synchronous WASM calls. LLM integration is optional and can be disabled at build time.

Future options:
- WASM Asyncify
- Oracle pattern for inference requests

---

## 10. Deployment Considerations
### 10.1 Browser Deployment
- HTTPS required
- `application/wasm` content‑type
- Service worker cache strategy for offline use
- WebCrypto required for hashing/proof verification
- Quantum Verkle WASM assets must be served and reachable by `moduleUrl`/`wasmUrl`.
  Defaults resolve relative to the package’s bundled `dist/wasm` assets.

### 10.2 Compute Node Integration
SpaceKitJS can export rollup bundles for compute node validation to support long‑term archival and portability across devices and nodes. 

---

## 11. Dependencies on Decentralized Infrastructure
SpaceKit-JS is designed to interoperate with:
- **SpaceKit Storage Node**: Zero‑knowledge, PQ‑encrypted storage and sync
- **SpaceKit Compute Node**: Rollup validation + block finalization
- **SpaceKit Messaging Node**: Event routing + P2P coordination

These dependencies enable decentralized state sync and long‑term archival while maintaining
browser‑native execution. Extension wallet integration is optional and outside the core VM.

---

## 12. Roadmap & Next Steps
- Gas metering tuning + cost model calibration
- Async host functions / Asyncify exploration
- Multi‑node consensus (PoA → PoS) with proposer signatures
- Incremental state sync (delta updates)
- Stateless sync enhancements (Quantum Verkle proof batching, snapshot anchoring)
- Stronger ACL enforcement for storage node
- Security audit + formal threat model

---

## References
- SpaceKitJS README (`spacekit-js/README.md`)
- Developer Docs (`spacekit-js/docs/*`)
- SpaceKit Storage Node Whitepaper  
  [SpaceKit-Storage-Node-Whitepaper-v1.0.pdf](file://SpaceKit-Storage-Node-Whitepaper-v1.0.pdf)

