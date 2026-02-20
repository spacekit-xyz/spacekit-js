/** Vocabulary size (must match contract / WASM if you add Rust impl later). */
export declare const MICROGPT_VOCAB_SIZE = 8;
/**
 * Pure forward pass for one (token_id, pos_id). Returns logits of shape [VOCAB_SIZE].
 * Deterministic, no IO, no randomness — suitable as a SpaceKit host primitive.
 */
export declare function microgpt_forward(token_id: number, pos_id: number): Float32Array;
