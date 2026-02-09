# Host ABI + Contract Development

Spacekit contracts are compiled to `wasm32-unknown-unknown` and expect a deterministic
host ABI. The JS host implements the import modules required by the Rust SDK.

## Import modules
Core modules implemented by the host:
- `env`
- `spacekit_storage`
- `sk_erc20`
- `sk_erc721`
- `spacekit_reputation`
- `spacekit_fact`
- `spacekit_llm`

## Storage semantics
Some legacy contracts call a 2-arg `storage_read` and only get length. Newer contracts
use a 4-arg read with output buffer. The host supports both.

## Events
Contracts can emit events; the host collects them into receipts. See VM receipts and
`vm_receiptProof` for inclusion proofs.

## Payable calls
Contracts can read attached value via `env.msg_value()` (u64). The VM can attach value
when submitting transactions (JS VM and compute-node).

## ABI versioning
Use `HOST_ABI_VERSION` and `vm_hostAbi` to ensure deterministic execution across
browser and compute-node runtimes.
