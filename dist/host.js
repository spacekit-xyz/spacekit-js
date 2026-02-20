import { MemoryView, LinearMemoryAllocator } from "./memory.js";
import { createInMemoryStorage } from "./storage.js";
import { microgpt_forward } from "./llm/microgpt_forward.js";
/**
 * LLM status codes used by host functions
 */
export const LLM_STATUS = {
    NOT_LOADED: 0,
    READY: 1,
    LOADING: 2,
};
function toBigInt(value) {
    return typeof value === "bigint" ? value : BigInt(value);
}
function toNumber(value) {
    return typeof value === "bigint" ? Number(value) : value;
}
class InMemoryTokenAdapter {
    balances = new Map();
    supply = 0n;
    balanceOf(did) {
        return this.balances.get(did) ?? 0n;
    }
    transfer(from, to, amount) {
        if (amount <= 0n) {
            return false;
        }
        const fromBal = this.balanceOf(from);
        if (fromBal < amount) {
            return false;
        }
        this.balances.set(from, fromBal - amount);
        this.balances.set(to, this.balanceOf(to) + amount);
        return true;
    }
    totalSupply() {
        return this.supply;
    }
    mint(to, amount) {
        if (amount <= 0n) {
            return;
        }
        this.supply += amount;
        this.balances.set(to, this.balanceOf(to) + amount);
    }
}
class InMemoryNftAdapter {
    counters = new Map();
    owners = new Map();
    mint(contractId, owner) {
        const next = (this.counters.get(contractId) ?? 0n) + 1n;
        this.counters.set(contractId, next);
        let registry = this.owners.get(contractId);
        if (!registry) {
            registry = new Map();
            this.owners.set(contractId, registry);
        }
        registry.set(next, owner);
        return next;
    }
    ownerOf(contractId, tokenId) {
        return this.owners.get(contractId)?.get(tokenId) ?? null;
    }
    transfer(contractId, tokenId, to) {
        const registry = this.owners.get(contractId);
        if (!registry || !registry.has(tokenId)) {
            return false;
        }
        registry.set(tokenId, to);
        return true;
    }
}
class InMemoryReputationAdapter {
    scores = new Map();
    getScore(did, repType) {
        return this.scores.get(did)?.get(repType) ?? 0n;
    }
    checkThreshold(did, repType, threshold) {
        return this.getScore(did, repType) >= threshold;
    }
    getOverall(did) {
        const perType = this.scores.get(did);
        if (!perType || perType.size === 0) {
            return 0n;
        }
        let total = 0n;
        for (const score of perType.values()) {
            total += score;
        }
        return total / BigInt(perType.size);
    }
    getBreakdown(did) {
        const perType = this.scores.get(did);
        const result = Array.from({ length: 6 }, () => 0n);
        if (!perType) {
            return result;
        }
        for (const [type, score] of perType.entries()) {
            if (type >= 0 && type < result.length) {
                result[type] = score;
            }
        }
        return result;
    }
}
class InMemoryFactAdapter {
    entries = new Map();
    register(packageId, hash) {
        this.entries.set(packageId, hash);
    }
    exists(packageId) {
        return this.entries.has(packageId);
    }
    verifyHash(packageId, hash) {
        return this.entries.get(packageId) === hash;
    }
}
class NoopCompressionAdapter {
    compress(data) {
        return data;
    }
    decompress(data) {
        return data;
    }
}
class NoopLlmAdapter {
    infer(prompt, _maxTokens, _temperature) {
        return `[LLM not configured] Prompt: ${prompt.slice(0, 50)}...`;
    }
    getStatus() {
        return LLM_STATUS.NOT_LOADED;
    }
}
class ConsoleLogger {
    log(message) {
        console.log(message);
    }
}
class HostContextImpl {
    memoryView;
    allocator;
    storage;
    token;
    nft;
    reputation;
    fact;
    compression;
    llm;
    logger;
    callerDid;
    contractId;
    contractCall;
    msgValue;
    events = [];
    gasUsed = 0;
    gasLimit = 0;
    llmResponse = "";
    constructor(options) {
        const memory = new WebAssembly.Memory({ initial: 2 });
        this.memoryView = new MemoryView(memory);
        this.allocator = new LinearMemoryAllocator(memory);
        this.storage = options.storage ?? createInMemoryStorage();
        this.token = options.token ?? new InMemoryTokenAdapter();
        this.nft = options.nft ?? new InMemoryNftAdapter();
        this.reputation = options.reputation ?? new InMemoryReputationAdapter();
        this.fact = options.fact ?? new InMemoryFactAdapter();
        this.compression = options.compression ?? new NoopCompressionAdapter();
        this.llm = options.llm ?? new NoopLlmAdapter();
        this.logger = options.logger ?? new ConsoleLogger();
        this.callerDid = options.callerDid ?? "did:spacekit:browser:anonymous";
        this.contractCall = options.contractCall;
        this.msgValue = 0n;
        this.events = [];
    }
    setMemory(memory) {
        this.memoryView.setMemory(memory);
        this.allocator.setMemory(memory);
    }
    readBytes(ptr, len) {
        return this.memoryView.readBytes(ptr, len);
    }
    writeBytes(ptr, data) {
        this.memoryView.writeBytes(ptr, data);
    }
    readString(ptr, len) {
        return this.memoryView.readString(ptr, len);
    }
    writeString(ptr, value) {
        return this.memoryView.writeString(ptr, value);
    }
    alloc(size) {
        return this.allocator.alloc(size);
    }
    setGasLimit(limit) {
        this.gasLimit = limit;
        this.gasUsed = 0;
    }
    consumeGas(amount) {
        if (!Number.isFinite(amount) || amount <= 0) {
            return;
        }
        this.gasUsed += amount;
        if (this.gasLimit > 0 && this.gasUsed > this.gasLimit) {
            throw new Error("Out of gas");
        }
    }
    setLlmResponse(value) {
        this.llmResponse = value;
    }
    getLlmResponse() {
        return this.llmResponse;
    }
}
function readKey(ctx, ptr, len) {
    return ctx.readBytes(ptr, len);
}
function readDid(ctx, ptr, len) {
    return ctx.readString(ptr, len);
}
function readHash(ctx, ptr, len) {
    return ctx.readString(ptr, len);
}
function toContractDid(contractId, fallbackDid) {
    if (!contractId) {
        return fallbackDid;
    }
    if (contractId.startsWith("did:")) {
        return contractId;
    }
    return `did:spacekit:contract:${contractId}`;
}
function getTimestamp() {
    return BigInt(Math.floor(Date.now() / 1000));
}
export function createHost(options = {}) {
    const ctx = new HostContextImpl(options);
    const imports = createImports(ctx);
    return {
        context: ctx,
        imports,
        bindInstance(instance) {
            const memory = instance.exports.memory;
            if (!memory) {
                throw new Error("WASM instance does not export memory");
            }
            ctx.setMemory(memory);
        },
    };
}
export function createImports(ctx) {
    const storageRead = (keyPtr, keyLen, outputPtr, maxLen) => {
        const key = readKey(ctx, keyPtr, keyLen);
        const value = ctx.storage.get(key);
        if (!value) {
            return -1;
        }
        if (outputPtr === undefined || maxLen === undefined) {
            return value.length;
        }
        const len = Math.min(value.length, maxLen);
        ctx.writeBytes(outputPtr, value.subarray(0, len));
        return len;
    };
    const storageLoad = (keyPtr, keyLen, outputPtr, maxLen) => {
        const key = readKey(ctx, keyPtr, keyLen);
        const value = ctx.storage.get(key);
        if (!value) {
            return 0;
        }
        const len = Math.min(value.length, maxLen);
        ctx.writeBytes(outputPtr, value.subarray(0, len));
        return len;
    };
    const storageWrite = (keyPtr, keyLen, valuePtr, valueLen) => {
        const key = readKey(ctx, keyPtr, keyLen);
        const value = ctx.readBytes(valuePtr, valueLen);
        ctx.storage.set(key, value);
        return valueLen;
    };
    const tokenTransfer = (fromPtr, fromLen, toPtr, toLen, amount) => {
        const from = readDid(ctx, fromPtr, fromLen);
        const to = readDid(ctx, toPtr, toLen);
        return ctx.token.transfer(from, to, amount) ? 1 : 0;
    };
    const tokenBalance = (didPtr, didLen) => {
        return ctx.token.balanceOf(readDid(ctx, didPtr, didLen));
    };
    const nftMint = (contractIdPtr, contractIdLen, ownerPtr, ownerLen) => {
        const contractId = readDid(ctx, contractIdPtr, contractIdLen);
        const owner = readDid(ctx, ownerPtr, ownerLen);
        return ctx.nft.mint(contractId, owner);
    };
    const nftOwnerOf = (contractIdPtr, contractIdLen, tokenId, outputPtr, maxLen) => {
        const contractId = readDid(ctx, contractIdPtr, contractIdLen);
        const owner = ctx.nft.ownerOf(contractId, tokenId);
        if (!owner) {
            return -1;
        }
        const written = ctx.writeString(outputPtr, owner);
        return Math.min(written, maxLen);
    };
    const nftTransfer = (contractIdPtr, contractIdLen, tokenId, toPtr, toLen) => {
        const contractId = readDid(ctx, contractIdPtr, contractIdLen);
        const to = readDid(ctx, toPtr, toLen);
        return ctx.nft.transfer(contractId, tokenId, to) ? 1 : 0;
    };
    const reputationGetScore = (didPtr, didLen, repType) => {
        return ctx.reputation.getScore(readDid(ctx, didPtr, didLen), repType);
    };
    const reputationCheckThreshold = (didPtr, didLen, repType, threshold) => {
        const did = readDid(ctx, didPtr, didLen);
        return ctx.reputation.checkThreshold(did, repType, threshold) ? 1 : 0;
    };
    const reputationGetOverall = (didPtr, didLen) => {
        return ctx.reputation.getOverall(readDid(ctx, didPtr, didLen));
    };
    const reputationGetBreakdown = (didPtr, didLen, outputPtr) => {
        const did = readDid(ctx, didPtr, didLen);
        const scores = ctx.reputation.getBreakdown(did);
        const out = new BigInt64Array(scores.length);
        for (let i = 0; i < scores.length; i += 1) {
            out[i] = scores[i];
        }
        ctx.writeBytes(outputPtr, new Uint8Array(out.buffer));
    };
    const factExists = (packageIdPtr, packageIdLen) => {
        const packageId = readDid(ctx, packageIdPtr, packageIdLen);
        return ctx.fact.exists(packageId) ? 1 : 0;
    };
    const factVerifyHash = (packageIdPtr, packageIdLen, hashPtr, hashLen) => {
        const packageId = readDid(ctx, packageIdPtr, packageIdLen);
        const hash = readHash(ctx, hashPtr, hashLen);
        return ctx.fact.verifyHash(packageId, hash) ? 1 : 0;
    };
    const pythonCompress = (inputPtr, inputLen, modePtr, modeLen, outputPtr, outputMaxLen) => {
        const input = ctx.readBytes(inputPtr, inputLen);
        const mode = ctx.readString(modePtr, modeLen);
        const output = ctx.compression.compress(input, mode);
        const len = Math.min(output.length, outputMaxLen);
        ctx.writeBytes(outputPtr, output.subarray(0, len));
        return len;
    };
    const pythonDecompress = (inputPtr, inputLen, modePtr, modeLen, outputPtr, outputMaxLen) => {
        const input = ctx.readBytes(inputPtr, inputLen);
        const mode = ctx.readString(modePtr, modeLen);
        const output = ctx.compression.decompress(input, mode);
        const len = Math.min(output.length, outputMaxLen);
        ctx.writeBytes(outputPtr, output.subarray(0, len));
        return len;
    };
    /**
     * LLM inference host function
     * Signature matches SDK: llm_inference(prompt_ptr, prompt_len, dest_ptr, max_len, temperature, max_tokens) -> i32
     * Returns: >0 = bytes written, -1 = LLM not ready, -2 = inference error
     */
    const llmInference = (promptPtr, promptLen, destPtr, maxLen, temperature, // temperature * 100 (e.g., 70 = 0.7)
    maxTokens) => {
        // Check if LLM is ready
        const status = ctx.llm.getStatus();
        if (status !== 1) { // LLM_STATUS.READY
            return -1; // Not ready
        }
        const prompt = ctx.readString(promptPtr, promptLen);
        try {
            const response = ctx.llm.infer(prompt, maxTokens, temperature);
            if (!response || response.length === 0) {
                return -2; // Inference error
            }
            // Write response directly to dest buffer
            const encoder = new TextEncoder();
            const responseBytes = encoder.encode(response);
            const bytesToWrite = Math.min(responseBytes.length, maxLen);
            ctx.writeBytes(destPtr, responseBytes.subarray(0, bytesToWrite));
            return bytesToWrite;
        }
        catch (e) {
            console.error("[SpacekitVM] LLM inference error:", e);
            return -2;
        }
    };
    /**
     * Get LLM status: 0 = not loaded, 1 = ready, 2 = loading
     */
    const llmStatus = () => {
        return ctx.llm.getStatus();
    };
    /**
     * Micro-GPT forward primitive: write logits to out_ptr (VOCAB_SIZE f32s).
     * Signature: microgpt_forward(token_id: u32, pos_id: u32, out_ptr: u32) -> void
     */
    const microgptForward = (tokenId, posId, outPtr) => {
        const logits = microgpt_forward(tokenId, posId);
        const bytes = new Uint8Array(logits.buffer, logits.byteOffset, logits.byteLength);
        ctx.writeBytes(outPtr, bytes);
    };
    const useGas = (amount) => {
        ctx.consumeGas(amount);
    };
    // AssemblyScript-compiled WASM may import env.abort (e.g. for assertions). Provide a stub.
    const envAbort = (message, fileName, line, column) => {
        console.warn("[SpaceKit] contract abort", { message, fileName, line, column });
    };
    const baseEnv = {
        abort: envAbort,
        storage_read: storageRead,
        storage_write: storageWrite,
        storage_save: storageWrite,
        storage_load: storageLoad,
        get_caller_did: (outputPtr, maxLen) => {
            const len = ctx.writeString(outputPtr, ctx.callerDid);
            return Math.min(len, maxLen);
        },
        verify_did: (didPtr, didLen) => {
            return readDid(ctx, didPtr, didLen).length > 0 ? 1 : 0;
        },
        log_output: (ptr, len) => {
            ctx.logger.log(ctx.readString(ptr, len));
        },
        emit_event: (typePtr, typeLen, dataPtr, dataLen) => {
            const type = ctx.readString(typePtr, typeLen);
            const data = ctx.readBytes(dataPtr, dataLen);
            ctx.events.push({ type, data });
        },
        msg_value: () => {
            return ctx.msgValue;
        },
        get_timestamp: () => {
            return getTimestamp();
        },
        reputation_get_score: reputationGetScore,
        reputation_check_threshold: reputationCheckThreshold,
        reputation_get_overall: reputationGetOverall,
        reputation_get_breakdown: reputationGetBreakdown,
        python_compress: pythonCompress,
        python_decompress: pythonDecompress,
    };
    return {
        metering: {
            usegas: useGas,
        },
        env: baseEnv,
        spacekit_storage: {
            storage_save: storageWrite,
            storage_load: storageLoad,
        },
        spacekit_contract: {
            contract_call: (contractIdPtr, contractIdLen, inputPtr, inputLen, outputPtr, maxLen) => {
                if (!ctx.contractCall) {
                    return -1;
                }
                try {
                    const contractId = ctx.readString(contractIdPtr, contractIdLen);
                    const input = ctx.readBytes(inputPtr, inputLen);
                    const callerDid = toContractDid(ctx.contractId, ctx.callerDid);
                    const { status, result } = ctx.contractCall.call(contractId, input, callerDid, 0n);
                    if (status <= 0) {
                        return status;
                    }
                    const len = Math.min(result.length, maxLen);
                    ctx.writeBytes(outputPtr, result.subarray(0, len));
                    return len;
                }
                catch (err) {
                    console.error("[SpacekitVM] contract_call error:", err);
                    return -2;
                }
            },
        },
        sk_erc20: {
            token_transfer: tokenTransfer,
            token_balance: tokenBalance,
        },
        sk_erc721: {
            nft_mint: nftMint,
            nft_owner_of: nftOwnerOf,
            nft_transfer: nftTransfer,
        },
        spacekit_reputation: {
            reputation_get_score: reputationGetScore,
            reputation_check_threshold: reputationCheckThreshold,
            reputation_get_overall: reputationGetOverall,
            reputation_get_breakdown: reputationGetBreakdown,
        },
        spacekit_fact: {
            fact_package_exists: factExists,
            fact_verify_hash: factVerifyHash,
        },
        spacekit_llm: {
            llm_inference: llmInference,
            llm_status: llmStatus,
        },
        spacekit_microgpt: {
            microgpt_forward: microgptForward,
        },
    };
}
export { HostContextImpl };
