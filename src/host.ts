import { MemoryView, LinearMemoryAllocator } from "./memory.js";
import { StorageAdapter, createInMemoryStorage } from "./storage.js";

export interface TokenAdapter {
  balanceOf(did: string): bigint;
  transfer(from: string, to: string, amount: bigint): boolean;
  totalSupply(): bigint;
}

export interface NftAdapter {
  mint(contractId: string, owner: string): bigint;
  ownerOf(contractId: string, tokenId: bigint): string | null;
  transfer(contractId: string, tokenId: bigint, to: string): boolean;
}

export interface ReputationAdapter {
  getScore(did: string, repType: number): bigint;
  checkThreshold(did: string, repType: number, threshold: bigint): boolean;
  getOverall(did: string): bigint;
  getBreakdown(did: string): bigint[];
}

export interface FactAdapter {
  exists(packageId: string): boolean;
  verifyHash(packageId: string, hash: string): boolean;
}

export interface ContractCallResult {
  status: number;
  result: Uint8Array;
}

export interface ContractCallAdapter {
  call(
    contractId: string,
    input: Uint8Array,
    callerDid: string,
    value?: bigint
  ): ContractCallResult;
}

export interface CompressionAdapter {
  compress(data: Uint8Array, mode: string): Uint8Array;
  decompress(data: Uint8Array, mode: string): Uint8Array;
}

/**
 * LLM status codes used by host functions
 */
export const LLM_STATUS = {
  NOT_LOADED: 0,
  READY: 1,
  LOADING: 2,
} as const;

export type LlmStatus = typeof LLM_STATUS[keyof typeof LLM_STATUS];

/**
 * Captured LLM request from contract execution (for two-phase inference)
 */
export interface CapturedLlmRequest {
  prompt: string;
  maxTokens: number;
  temperature: number;
}

/**
 * LLM Adapter interface for integrating language models with smart contracts.
 * 
 * The infer method is synchronous because WASM host functions cannot be async.
 * Implementations should pre-load models and cache responses.
 * 
 * Two-phase execution pattern:
 * 1. Contract runs in "capture mode" - llm_call records prompt but returns placeholder
 * 2. Host runs async inference with captured prompt
 * 3. Contract runs again - llm_call returns cached result
 */
export interface LlmAdapter {
  /**
   * Run inference on a prompt. Must be synchronous.
   * @param prompt - The input prompt
   * @param maxTokens - Maximum tokens to generate  
   * @param temperature - Sampling temperature (0-100, e.g., 70 = 0.7)
   * @returns The generated text, or empty string on failure
   */
  infer(prompt: string, maxTokens: number, temperature: number): string;
  
  /**
   * Get the current LLM status
   * @returns 0 = not loaded, 1 = ready, 2 = loading
   */
  getStatus(): LlmStatus;
  
  /**
   * Enable/disable capture mode for two-phase execution.
   * In capture mode, infer() records the request but returns empty string.
   */
  setCaptureMode?(enabled: boolean): void;
  
  /**
   * Get the captured LLM request from the last capture-mode execution.
   */
  getCapturedRequest?(): CapturedLlmRequest | null;
  
  /**
   * Clear any captured request.
   */
  clearCapturedRequest?(): void;
}

export interface Logger {
  log(message: string): void;
}

export interface HostOptions {
  storage?: StorageAdapter;
  token?: TokenAdapter;
  nft?: NftAdapter;
  reputation?: ReputationAdapter;
  fact?: FactAdapter;
  compression?: CompressionAdapter;
  llm?: LlmAdapter;
  logger?: Logger;
  callerDid?: string;
  contractCall?: ContractCallAdapter;
}

export interface HostContext {
  setMemory(memory: WebAssembly.Memory): void;
  readBytes(ptr: number, len: number): Uint8Array;
  writeBytes(ptr: number, data: Uint8Array): void;
  readString(ptr: number, len: number): string;
  writeString(ptr: number, value: string): number;
  alloc(size: number): number;
  events: Array<{ type: string; data: Uint8Array }>;
  callerDid: string;
  msgValue: bigint;
  gasUsed: number;
  gasLimit: number;
  setGasLimit(limit: number): void;
  consumeGas(amount: number): void;
  contractId?: string;
  contractCall?: ContractCallAdapter;
}

function toBigInt(value: number | bigint): bigint {
  return typeof value === "bigint" ? value : BigInt(value);
}

function toNumber(value: number | bigint): number {
  return typeof value === "bigint" ? Number(value) : value;
}

class InMemoryTokenAdapter implements TokenAdapter {
  private balances = new Map<string, bigint>();
  private supply = 0n;

  balanceOf(did: string): bigint {
    return this.balances.get(did) ?? 0n;
  }

  transfer(from: string, to: string, amount: bigint): boolean {
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

  totalSupply(): bigint {
    return this.supply;
  }

  mint(to: string, amount: bigint) {
    if (amount <= 0n) {
      return;
    }
    this.supply += amount;
    this.balances.set(to, this.balanceOf(to) + amount);
  }
}

class InMemoryNftAdapter implements NftAdapter {
  private counters = new Map<string, bigint>();
  private owners = new Map<string, Map<bigint, string>>();

  mint(contractId: string, owner: string): bigint {
    const next = (this.counters.get(contractId) ?? 0n) + 1n;
    this.counters.set(contractId, next);
    let registry = this.owners.get(contractId);
    if (!registry) {
      registry = new Map<bigint, string>();
      this.owners.set(contractId, registry);
    }
    registry.set(next, owner);
    return next;
  }

  ownerOf(contractId: string, tokenId: bigint): string | null {
    return this.owners.get(contractId)?.get(tokenId) ?? null;
  }

  transfer(contractId: string, tokenId: bigint, to: string): boolean {
    const registry = this.owners.get(contractId);
    if (!registry || !registry.has(tokenId)) {
      return false;
    }
    registry.set(tokenId, to);
    return true;
  }
}

class InMemoryReputationAdapter implements ReputationAdapter {
  private scores = new Map<string, Map<number, bigint>>();

  getScore(did: string, repType: number): bigint {
    return this.scores.get(did)?.get(repType) ?? 0n;
  }

  checkThreshold(did: string, repType: number, threshold: bigint): boolean {
    return this.getScore(did, repType) >= threshold;
  }

  getOverall(did: string): bigint {
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

  getBreakdown(did: string): bigint[] {
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

class InMemoryFactAdapter implements FactAdapter {
  private entries = new Map<string, string>();

  register(packageId: string, hash: string) {
    this.entries.set(packageId, hash);
  }

  exists(packageId: string): boolean {
    return this.entries.has(packageId);
  }

  verifyHash(packageId: string, hash: string): boolean {
    return this.entries.get(packageId) === hash;
  }
}

class NoopCompressionAdapter implements CompressionAdapter {
  compress(data: Uint8Array): Uint8Array {
    return data;
  }

  decompress(data: Uint8Array): Uint8Array {
    return data;
  }
}

class NoopLlmAdapter implements LlmAdapter {
  infer(prompt: string, _maxTokens: number, _temperature: number): string {
    return `[LLM not configured] Prompt: ${prompt.slice(0, 50)}...`;
  }
  
  getStatus(): LlmStatus {
    return LLM_STATUS.NOT_LOADED;
  }
}

class ConsoleLogger implements Logger {
  log(message: string) {
    console.log(message);
  }
}

class HostContextImpl implements HostContext {
  private memoryView: MemoryView;
  private allocator: LinearMemoryAllocator;

  storage: StorageAdapter;
  token: TokenAdapter;
  nft: NftAdapter;
  reputation: ReputationAdapter;
  fact: FactAdapter;
  compression: CompressionAdapter;
  llm: LlmAdapter;
  logger: Logger;
  callerDid: string;
  contractId?: string;
  contractCall?: ContractCallAdapter;
  msgValue: bigint;
  events: Array<{ type: string; data: Uint8Array }> = [];
  gasUsed = 0;
  gasLimit = 0;

  private llmResponse = "";

  constructor(options: HostOptions) {
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

  setMemory(memory: WebAssembly.Memory) {
    this.memoryView.setMemory(memory);
    this.allocator.setMemory(memory);
  }

  readBytes(ptr: number, len: number): Uint8Array {
    return this.memoryView.readBytes(ptr, len);
  }

  writeBytes(ptr: number, data: Uint8Array): void {
    this.memoryView.writeBytes(ptr, data);
  }

  readString(ptr: number, len: number): string {
    return this.memoryView.readString(ptr, len);
  }

  writeString(ptr: number, value: string): number {
    return this.memoryView.writeString(ptr, value);
  }

  alloc(size: number): number {
    return this.allocator.alloc(size);
  }

  setGasLimit(limit: number): void {
    this.gasLimit = limit;
    this.gasUsed = 0;
  }

  consumeGas(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }
    this.gasUsed += amount;
    if (this.gasLimit > 0 && this.gasUsed > this.gasLimit) {
      throw new Error("Out of gas");
    }
  }

  setLlmResponse(value: string) {
    this.llmResponse = value;
  }

  getLlmResponse(): string {
    return this.llmResponse;
  }
}

function readKey(ctx: HostContextImpl, ptr: number, len: number): Uint8Array {
  return ctx.readBytes(ptr, len);
}

function readDid(ctx: HostContextImpl, ptr: number, len: number): string {
  return ctx.readString(ptr, len);
}

function readHash(ctx: HostContextImpl, ptr: number, len: number): string {
  return ctx.readString(ptr, len);
}

function toContractDid(contractId: string | undefined, fallbackDid: string): string {
  if (!contractId) {
    return fallbackDid;
  }
  if (contractId.startsWith("did:")) {
    return contractId;
  }
  return `did:spacekit:contract:${contractId}`;
}

function getTimestamp(): bigint {
  return BigInt(Math.floor(Date.now() / 1000));
}

export function createHost(options: HostOptions = {}) {
  const ctx = new HostContextImpl(options);
  const imports = createImports(ctx);

  return {
    context: ctx,
    imports,
    bindInstance(instance: WebAssembly.Instance) {
      const memory = instance.exports.memory as WebAssembly.Memory | undefined;
      if (!memory) {
        throw new Error("WASM instance does not export memory");
      }
      ctx.setMemory(memory);
    },
  };
}

export function createImports(ctx: HostContextImpl): WebAssembly.Imports {
  const storageRead = (
    keyPtr: number,
    keyLen: number,
    outputPtr?: number,
    maxLen?: number
  ): number => {
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

  const storageLoad = (
    keyPtr: number,
    keyLen: number,
    outputPtr: number,
    maxLen: number
  ): number => {
    const key = readKey(ctx, keyPtr, keyLen);
    const value = ctx.storage.get(key);
    if (!value) {
      return 0;
    }
    const len = Math.min(value.length, maxLen);
    ctx.writeBytes(outputPtr, value.subarray(0, len));
    return len;
  };

  const storageWrite = (keyPtr: number, keyLen: number, valuePtr: number, valueLen: number): number => {
    const key = readKey(ctx, keyPtr, keyLen);
    const value = ctx.readBytes(valuePtr, valueLen);
    ctx.storage.set(key, value);
    return valueLen;
  };

  const tokenTransfer = (
    fromPtr: number,
    fromLen: number,
    toPtr: number,
    toLen: number,
    amount: bigint
  ): number => {
    const from = readDid(ctx, fromPtr, fromLen);
    const to = readDid(ctx, toPtr, toLen);
    return ctx.token.transfer(from, to, amount) ? 1 : 0;
  };

  const tokenBalance = (didPtr: number, didLen: number): bigint => {
    return ctx.token.balanceOf(readDid(ctx, didPtr, didLen));
  };

  const nftMint = (
    contractIdPtr: number,
    contractIdLen: number,
    ownerPtr: number,
    ownerLen: number
  ): bigint => {
    const contractId = readDid(ctx, contractIdPtr, contractIdLen);
    const owner = readDid(ctx, ownerPtr, ownerLen);
    return ctx.nft.mint(contractId, owner);
  };

  const nftOwnerOf = (
    contractIdPtr: number,
    contractIdLen: number,
    tokenId: bigint,
    outputPtr: number,
    maxLen: number
  ): number => {
    const contractId = readDid(ctx, contractIdPtr, contractIdLen);
    const owner = ctx.nft.ownerOf(contractId, tokenId);
    if (!owner) {
      return -1;
    }
    const written = ctx.writeString(outputPtr, owner);
    return Math.min(written, maxLen);
  };

  const nftTransfer = (
    contractIdPtr: number,
    contractIdLen: number,
    tokenId: bigint,
    toPtr: number,
    toLen: number
  ): number => {
    const contractId = readDid(ctx, contractIdPtr, contractIdLen);
    const to = readDid(ctx, toPtr, toLen);
    return ctx.nft.transfer(contractId, tokenId, to) ? 1 : 0;
  };

  const reputationGetScore = (didPtr: number, didLen: number, repType: number): bigint => {
    return ctx.reputation.getScore(readDid(ctx, didPtr, didLen), repType);
  };

  const reputationCheckThreshold = (
    didPtr: number,
    didLen: number,
    repType: number,
    threshold: bigint
  ): number => {
    const did = readDid(ctx, didPtr, didLen);
    return ctx.reputation.checkThreshold(did, repType, threshold) ? 1 : 0;
  };

  const reputationGetOverall = (didPtr: number, didLen: number): bigint => {
    return ctx.reputation.getOverall(readDid(ctx, didPtr, didLen));
  };

  const reputationGetBreakdown = (didPtr: number, didLen: number, outputPtr: number) => {
    const did = readDid(ctx, didPtr, didLen);
    const scores = ctx.reputation.getBreakdown(did);
    const out = new BigInt64Array(scores.length);
    for (let i = 0; i < scores.length; i += 1) {
      out[i] = scores[i];
    }
    ctx.writeBytes(outputPtr, new Uint8Array(out.buffer));
  };

  const factExists = (packageIdPtr: number, packageIdLen: number): number => {
    const packageId = readDid(ctx, packageIdPtr, packageIdLen);
    return ctx.fact.exists(packageId) ? 1 : 0;
  };

  const factVerifyHash = (
    packageIdPtr: number,
    packageIdLen: number,
    hashPtr: number,
    hashLen: number
  ): number => {
    const packageId = readDid(ctx, packageIdPtr, packageIdLen);
    const hash = readHash(ctx, hashPtr, hashLen);
    return ctx.fact.verifyHash(packageId, hash) ? 1 : 0;
  };

  const pythonCompress = (
    inputPtr: number,
    inputLen: number,
    modePtr: number,
    modeLen: number,
    outputPtr: number,
    outputMaxLen: number
  ): number => {
    const input = ctx.readBytes(inputPtr, inputLen);
    const mode = ctx.readString(modePtr, modeLen);
    const output = ctx.compression.compress(input, mode);
    const len = Math.min(output.length, outputMaxLen);
    ctx.writeBytes(outputPtr, output.subarray(0, len));
    return len;
  };

  const pythonDecompress = (
    inputPtr: number,
    inputLen: number,
    modePtr: number,
    modeLen: number,
    outputPtr: number,
    outputMaxLen: number
  ): number => {
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
  const llmInference = (
    promptPtr: number,
    promptLen: number,
    destPtr: number,
    maxLen: number,
    temperature: number, // temperature * 100 (e.g., 70 = 0.7)
    maxTokens: number
  ): number => {
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
    } catch (e) {
      console.error("[SpacekitVM] LLM inference error:", e);
      return -2;
    }
  };

  /**
   * Get LLM status: 0 = not loaded, 1 = ready, 2 = loading
   */
  const llmStatus = (): number => {
    return ctx.llm.getStatus();
  };

  const useGas = (amount: number) => {
    ctx.consumeGas(amount);
  };

  const baseEnv = {
    storage_read: storageRead,
    storage_write: storageWrite,
    storage_save: storageWrite,
    storage_load: storageLoad,
    get_caller_did: (outputPtr: number, maxLen: number): number => {
      const len = ctx.writeString(outputPtr, ctx.callerDid);
      return Math.min(len, maxLen);
    },
    verify_did: (didPtr: number, didLen: number): number => {
      return readDid(ctx, didPtr, didLen).length > 0 ? 1 : 0;
    },
    log_output: (ptr: number, len: number) => {
      ctx.logger.log(ctx.readString(ptr, len));
    },
    emit_event: (typePtr: number, typeLen: number, dataPtr: number, dataLen: number) => {
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
      contract_call: (
        contractIdPtr: number,
        contractIdLen: number,
        inputPtr: number,
        inputLen: number,
        outputPtr: number,
        maxLen: number
      ): number => {
        if (!ctx.contractCall) {
          return -1;
        }
        try {
          const contractId = ctx.readString(contractIdPtr, contractIdLen);
          const input = ctx.readBytes(inputPtr, inputLen);
          const callerDid = toContractDid(ctx.contractId, ctx.callerDid);
          const { status, result } = ctx.contractCall.call(
            contractId,
            input,
            callerDid,
            0n
          );
          if (status <= 0) {
            return status;
          }
          const len = Math.min(result.length, maxLen);
          ctx.writeBytes(outputPtr, result.subarray(0, len));
          return len;
        } catch (err) {
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
  };
}

export { HostContextImpl };
