# VM API

The `SpacekitVm` class manages contract deployment, transactions, blocks, and proofs.

## Core lifecycle
- `deployContract(wasm, contractId?)`
- `submitTransaction(contractId, input, callerDid)`
- `mineBlock()`

## Block control
- `startAutoMiner({ intervalMs, onlyIfPending })`
- `stopAutoMiner()`

## State and proofs
- `computeStateRoot()` (internal)
- `computeQuantumStateRoot()` (Quantum Verkle root)
- `getQuantumStateProof(keyHex)` (Quantum Verkle proof)
- `verifyComputeNodeQuantumStateProof(proof, header?)` (stateless verification)
- `BlockHeader.quantumStateRoot` (anchor for stateless verification)
- `vm_txProof`, `vm_receiptProof`, `vm_stateProof` via JSON-RPC
- `vm_quantumStateRoot`, `vm_quantumStateProof` via JSON-RPC

## Sequencer
Use `SpacekitSequencer` to bundle blocks and export rollups:
- `mineAndBundle()`
- `flushBundle()`
- `signBundle()`
- `exportBundle()` / `exportSignedBundle()`
