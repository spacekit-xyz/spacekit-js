import { createHost } from "../host.js";
import { instantiateWasm, callSpacekitMain } from "../runtime.js";
import { getActiveLlmAdapter } from "../llm/registry.js";
import { bytesToHex, hexToBytes } from "../storage.js";
import { sha256Hex, hashString } from "./hash.js";
import { HOST_ABI_VERSION } from "./abi.js";
import { Buffer } from "buffer";
import { merkleRoot, merkleProof } from "./merkle.js";
import { QuantumVerkleBridge, buildQuantumEntries, } from "./quantum_verkle.js";
import { DEFAULT_GENESIS_CONFIG, computeGenesisHashSync, isProtectedKey, createDidResolver, didDocumentKey, createDidDocument, serializeDidDocument, } from "./genesis.js";
import { IndexedDbBlockStore } from "./blockstore.js";
import { createSignatureVerifier, verifyTransactionSignature, } from "./signatures.js";
const DEFAULT_METERING_COST_TABLE = {
    start: 1,
    type: {
        params: { DEFAULT: 1 },
        return_type: { DEFAULT: 1 },
    },
    import: 5,
    code: {
        locals: { DEFAULT: 1 },
        code: { DEFAULT: 1 },
    },
    memory: (entry) => {
        if (entry && typeof entry === "object" && "maximum" in entry) {
            const max = entry.maximum ?? 1;
            return max * 10;
        }
        return 10;
    },
    data: 5,
};
function generateId(prefix) {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
function cloneEvents(events) {
    return events.map((event) => ({
        type: event.type,
        data: event.data.slice(),
    }));
}
export class SpacekitVm {
    contracts = new Map();
    pending = [];
    blocks = [];
    sealed = [];
    totalHeight = 0;
    maxBlocksInMemory;
    hostOptions;
    txIndex = new Map();
    receiptIndex = new Map();
    nonceByDid = new Map();
    chainId;
    feePolicy;
    gasPolicy;
    treasuryDid;
    pqVerifier;
    requirePqSignature;
    autoMinerTimer;
    autoMining = false;
    maxTxPerBlock = null;
    // Genesis and security state
    genesisConfig;
    genesisHash;
    didResolver = null;
    currentSupply = 0n;
    // Persistent block storage
    blockStore = null;
    blockStoreReady = false;
    // Signature verification
    signatureVerifier;
    requireSignature;
    devMode;
    enableWasmMetering;
    meteringCostTable;
    internalCallDepth = 0;
    maxInternalCallDepth = 8;
    quantumVerkle;
    quantumVerkleOptions;
    constructor(options = {}) {
        this.maxBlocksInMemory = options.maxBlocksInMemory ?? 100;
        const { storage, blockStore, ...hostOptions } = options;
        const registryAdapter = getActiveLlmAdapter();
        this.hostOptions = {
            ...hostOptions,
            storage,
            llm: hostOptions.llm ?? registryAdapter ?? undefined,
            contractCall: (contractId, input, callerDid, value) => this.callContractInternal(contractId, input, callerDid, value),
        };
        this.chainId = options.chainId ?? "spacekitvm-local";
        this.feePolicy = options.feePolicy ?? { baseFee: 1000n, perByteFee: 2n };
        this.gasPolicy = options.gasPolicy ?? { gasPerByte: 1, gasLimit: 1_000_000 };
        this.treasuryDid = options.treasuryDid ?? "did:spacekit:treasury";
        this.pqVerifier = options.pqVerifier;
        this.requirePqSignature = options.requirePqSignature ?? false;
        // Initialize genesis configuration
        this.genesisConfig = options.genesisConfig ?? DEFAULT_GENESIS_CONFIG;
        this.genesisHash = computeGenesisHashSync(this.genesisConfig);
        const configuredMax = options.maxTxPerBlock ?? this.genesisConfig.maxTxPerBlock ?? null;
        this.maxTxPerBlock = configuredMax && configuredMax > 0 ? configuredMax : null;
        // Initialize DID resolver if storage is available
        if (storage) {
            this.didResolver = createDidResolver(storage);
            this.initializeGenesis(storage);
        }
        // Initialize block store if enabled
        if (blockStore) {
            const storeOptions = typeof blockStore === "boolean"
                ? { maxBlocksInMemory: this.maxBlocksInMemory }
                : { maxBlocksInMemory: this.maxBlocksInMemory, ...blockStore };
            this.blockStore = new IndexedDbBlockStore(storeOptions);
        }
        // Initialize signature verification
        this.devMode = options.devMode ?? true; // Default to dev mode for backwards compatibility
        this.requireSignature = options.requireSignature ?? false;
        this.enableWasmMetering = options.enableWasmMetering ?? false;
        this.meteringCostTable = options.meteringCostTable ?? DEFAULT_METERING_COST_TABLE;
        this.signatureVerifier = createSignatureVerifier({
            pqVerifier: this.pqVerifier,
            devMode: this.devMode,
        });
        this.quantumVerkleOptions = options.quantumVerkle;
    }
    async initQuantumVerkle() {
        if (!this.quantumVerkleOptions?.enabled) {
            return;
        }
        if (!this.quantumVerkle) {
            this.quantumVerkle = await QuantumVerkleBridge.create(this.quantumVerkleOptions);
        }
    }
    /**
     * Set or update the LLM adapter at runtime.
     * Allows adding LLM support to an existing VM without re-initializing.
     */
    setLlmAdapter(adapter) {
        this.hostOptions.llm = adapter;
        // Update any already deployed contracts to use the new adapter
        for (const contract of this.contracts.values()) {
            const ctx = contract.context;
            if (ctx && "llm" in ctx) {
                ctx.llm = adapter;
            }
        }
    }
    /**
     * Get the current LLM adapter (if any).
     */
    getLlmAdapter() {
        return this.hostOptions.llm;
    }
    /**
     * Initialize block store (must be called before mining if blockStore is enabled).
     * Returns the latest block height from persistent storage.
     */
    async initBlockStore() {
        if (!this.blockStore) {
            return 0;
        }
        await this.blockStore.init();
        this.blockStoreReady = true;
        // Restore blocks from storage
        const stats = this.blockStore.getStats();
        this.totalHeight = stats.latestHeight;
        this.blocks = this.blockStore.getBlocksInMemory();
        // Rebuild indexes
        for (const block of this.blocks) {
            for (const tx of block.transactions) {
                this.txIndex.set(tx.id, tx);
            }
            for (const receipt of block.receipts) {
                this.receiptIndex.set(receipt.txId, receipt);
            }
        }
        return stats.latestHeight;
    }
    /**
     * Check if block store is enabled and ready.
     */
    isBlockStoreReady() {
        return this.blockStoreReady;
    }
    /**
     * Get block store statistics.
     */
    getBlockStoreStats() {
        if (!this.blockStore)
            return null;
        return this.blockStore.getStats();
    }
    /**
     * Initialize genesis state: seed treasury and register initial DIDs.
     */
    initializeGenesis(storage) {
        const config = this.genesisConfig;
        // Seed treasury with initial supply
        const treasuryKey = `native:astra:balance:${config.treasuryDid}`;
        const existing = storage.get(new TextEncoder().encode(treasuryKey));
        if (!existing || existing.length === 0) {
            const amount = config.nativeCurrency.initialTreasurySupply;
            const buffer = new ArrayBuffer(8);
            new DataView(buffer).setBigUint64(0, amount, true);
            storage.set(new TextEncoder().encode(treasuryKey), new Uint8Array(buffer));
            this.currentSupply = amount;
        }
        else {
            // Read current supply from treasury
            this.currentSupply = new DataView(existing.buffer, existing.byteOffset, 8).getBigUint64(0, true);
        }
        // Register initial DIDs
        for (const registration of config.initialDids) {
            const doc = createDidDocument(registration.did, registration.publicKeyHex, registration.algorithm);
            const key = new TextEncoder().encode(didDocumentKey(registration.did));
            const existingDoc = storage.get(key);
            if (!existingDoc || existingDoc.length === 0) {
                storage.set(key, serializeDidDocument(doc));
            }
        }
        // Store genesis config hash for audit
        const genesisKey = new TextEncoder().encode("genesis:config:hash");
        storage.set(genesisKey, new TextEncoder().encode(this.genesisHash));
    }
    /**
     * Get the genesis configuration hash.
     */
    getGenesisHash() {
        return this.genesisHash;
    }
    /**
     * Get the genesis configuration.
     */
    getGenesisConfig() {
        return this.genesisConfig;
    }
    /**
     * Get the DID resolver instance.
     */
    getDidResolver() {
        return this.didResolver;
    }
    /**
     * Resolve a DID to its document (public key, algorithm, etc.).
     */
    async resolveDid(did) {
        if (!this.didResolver) {
            return null;
        }
        return this.didResolver.resolve(did);
    }
    /**
     * Register a new DID with its public key.
     */
    async registerDid(did, publicKeyHex, algorithm = "ed25519") {
        if (!this.didResolver) {
            return false;
        }
        const doc = createDidDocument(did, publicKeyHex, algorithm);
        return this.didResolver.register(doc);
    }
    /**
     * Get the current total supply of native currency.
     */
    getCurrentSupply() {
        return this.currentSupply;
    }
    /**
     * Get the maximum supply cap from genesis.
     */
    getMaxSupply() {
        return this.genesisConfig.nativeCurrency.maxSupply;
    }
    getChainId() {
        return this.chainId;
    }
    /**
     * Check if a storage key is protected from contract modification.
     */
    isKeyProtected(key) {
        return isProtectedKey(key);
    }
    async deployContract(wasm, contractId) {
        const id = contractId ?? generateId("contract");
        const bytes = wasm instanceof Response ? await wasm.arrayBuffer() : wasm;
        const buffer = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const wasmHash = await sha256Hex(buffer);
        const host = createHost(this.hostOptions);
        const envImports = host.imports.env;
        if (!envImports || typeof envImports.msg_value !== "function") {
            host.imports.env.msg_value = () => 0n;
        }
        let meteredWasm = buffer;
        if (this.enableWasmMetering) {
            if (!globalThis.Buffer) {
                globalThis.Buffer = Buffer;
            }
            const { default: metering } = await import("wasm-metering");
            meteredWasm = metering.meterWASM(buffer, {
                meterType: "i32",
                costTable: this.meteringCostTable,
            });
        }
        const { instance } = await instantiateWasm(meteredWasm, host.imports);
        host.bindInstance(instance);
        host.context.contractId = id;
        const deployed = {
            id,
            wasmHash,
            abiVersion: HOST_ABI_VERSION,
            instance,
            context: host.context,
            setCaller: (did) => {
                host.context.callerDid = did;
            },
        };
        this.contracts.set(id, deployed);
        return deployed;
    }
    callContractInternal(contractId, input, callerDid, value = 0n) {
        if (this.internalCallDepth >= this.maxInternalCallDepth) {
            throw new Error("Max internal contract call depth exceeded");
        }
        const contract = this.getContract(contractId);
        const ctx = contract.context;
        const prevCaller = ctx.callerDid;
        const prevValue = ctx.msgValue;
        const prevEvents = ctx.events.slice();
        this.internalCallDepth += 1;
        try {
            contract.setCaller(callerDid);
            ctx.msgValue = value;
            ctx.events.length = 0;
            ctx.setGasLimit(this.gasPolicy.gasLimit);
            const { status, result } = callSpacekitMain(ctx, contract.instance, input);
            return { status, result };
        }
        finally {
            ctx.callerDid = prevCaller;
            ctx.msgValue = prevValue;
            ctx.events = prevEvents;
            this.internalCallDepth -= 1;
        }
    }
    getContract(contractId) {
        const contract = this.contracts.get(contractId);
        if (!contract) {
            throw new Error(`Contract not found: ${contractId}`);
        }
        return contract;
    }
    async executeTransaction(contractId, input, callerDid, value = 0n, txId) {
        const contract = this.getContract(contractId);
        contract.setCaller(callerDid);
        contract.context.msgValue = value;
        contract.context.events.length = 0;
        contract.context.setGasLimit(this.gasPolicy.gasLimit);
        const { status, result } = callSpacekitMain(contract.context, contract.instance, input);
        const receiptBase = {
            txId: txId ?? generateId("tx"),
            contractId,
            status,
            result,
            events: cloneEvents(contract.context.events),
            timestamp: Date.now(),
            gasUsed: contract.context.gasUsed,
        };
        const receiptHash = await hashReceipt(receiptBase);
        const receipt = { ...receiptBase, receiptHash };
        this.receiptIndex.set(receipt.txId, receipt);
        return receipt;
    }
    async submitTransaction(contractId, input, callerDid, value = 0n, signature) {
        const nonce = this.nonceByDid.get(callerDid) ?? 0;
        const timestamp = Date.now();
        const tx = {
            id: generateId("tx"),
            contractId,
            callerDid,
            input,
            value,
            timestamp,
            nonce,
            signature,
        };
        // Verify signature if required
        if (this.requireSignature && !this.devMode) {
            if (!signature) {
                throw new Error("Transaction signature required");
            }
            const isValid = await verifyTransactionSignature({ contractId, callerDid, input, value, nonce, timestamp }, signature, this.signatureVerifier);
            if (!isValid) {
                throw new Error("Invalid transaction signature");
            }
        }
        const gasEstimate = this.estimateGas(input.length);
        if (gasEstimate > this.gasPolicy.gasLimit) {
            throw new Error(`Gas limit exceeded: ${gasEstimate} > ${this.gasPolicy.gasLimit}`);
        }
        this.chargeFeeOrThrow(callerDid, input.length);
        this.transferValueOrThrow(callerDid, contractId, value);
        // Increment nonce after successful submission
        this.nonceByDid.set(callerDid, nonce + 1);
        const receipt = await this.executeTransaction(contractId, input, callerDid, value, tx.id);
        this.pending.push({ tx, receipt });
        this.txIndex.set(tx.id, tx);
        return tx;
    }
    /**
     * Check if signature verification is required
     */
    isSignatureRequired() {
        return this.requireSignature && !this.devMode;
    }
    /**
     * Check if running in dev mode
     */
    isDevMode() {
        return this.devMode;
    }
    /**
     * Get supported signature algorithms
     */
    getSupportedAlgorithms() {
        return this.signatureVerifier.supportedAlgorithms();
    }
    async mineBlock() {
        if (this.pending.length === 0) {
            return null;
        }
        const takeCount = this.maxTxPerBlock
            ? Math.min(this.pending.length, this.maxTxPerBlock)
            : this.pending.length;
        const pendingSlice = this.pending.slice(0, takeCount);
        const prevHash = this.blocks.length > 0 ? this.blocks[this.blocks.length - 1].blockHash : "genesis";
        const txs = pendingSlice.map((entry) => entry.tx);
        const receipts = pendingSlice.map((entry) => entry.receipt);
        const height = ++this.totalHeight;
        const timestamp = Date.now();
        const gasUsed = txs.reduce((sum, tx) => sum + tx.input.length * this.gasPolicy.gasPerByte, 0);
        const txHashes = await Promise.all(txs.map((tx) => hashTransaction(tx)));
        const receiptHashes = receipts.map((receipt) => receipt.receiptHash);
        const txRoot = await merkleRoot(txHashes);
        const receiptRoot = await merkleRoot(receiptHashes);
        const stateRoot = await this.computeStateRoot();
        const quantumStateRoot = await this.computeQuantumStateRoot();
        const blockPayload = {
            height,
            prevHash,
            stateRoot,
            quantumStateRoot,
            txRoot,
            receiptRoot,
            timestamp,
            txs: txs.map((tx) => ({
                id: tx.id,
                contractId: tx.contractId,
                callerDid: tx.callerDid,
                input: Array.from(tx.input),
                value: tx.value.toString(),
                timestamp: tx.timestamp,
            })),
            receipts: receipts.map((receipt) => ({
                txId: receipt.txId,
                contractId: receipt.contractId,
                status: receipt.status,
                result: Array.from(receipt.result),
                events: receipt.events.map((event) => ({
                    type: event.type,
                    data: Array.from(event.data),
                })),
                timestamp: receipt.timestamp,
            })),
        };
        const blockHash = await sha256Hex(hashString(JSON.stringify(blockPayload)));
        const header = {
            version: "0.1",
            chainId: this.chainId,
            height,
            timestamp,
            prevHash,
            blockHash,
            txRoot,
            receiptRoot,
            stateRoot,
            quantumStateRoot,
            txCount: txs.length,
            receiptCount: receipts.length,
            abiVersion: HOST_ABI_VERSION,
            gasLimit: this.gasPolicy.gasLimit,
            gasUsed,
            // Security audit trail
            genesisHash: this.genesisHash,
            totalSupply: this.currentSupply.toString(),
            supplyCap: this.genesisConfig.nativeCurrency.maxSupply.toString(),
        };
        const block = {
            height,
            prevHash,
            blockHash,
            stateRoot,
            quantumStateRoot,
            txRoot,
            receiptRoot,
            timestamp,
            transactions: txs,
            receipts,
            header,
        };
        this.blocks.push(block);
        this.pending = this.pending.slice(takeCount);
        // Persist to block store if enabled
        if (this.blockStore && this.blockStoreReady) {
            await this.blockStore.addBlock(block);
        }
        else if (this.blocks.length >= this.maxBlocksInMemory) {
            // Only seal if not using persistent storage
            await this.sealBlocks();
        }
        return block;
    }
    startAutoMiner(options) {
        const { intervalMs, onlyIfPending = true } = options;
        if (this.autoMinerTimer) {
            clearInterval(this.autoMinerTimer);
        }
        const tick = async () => {
            if (this.autoMining) {
                return;
            }
            this.autoMining = true;
            try {
                if (onlyIfPending && this.pending.length === 0) {
                    return;
                }
                await this.mineBlock();
            }
            finally {
                this.autoMining = false;
            }
        };
        this.autoMinerTimer = setInterval(() => {
            void tick();
        }, intervalMs);
        return () => this.stopAutoMiner();
    }
    stopAutoMiner() {
        if (this.autoMinerTimer) {
            clearInterval(this.autoMinerTimer);
            this.autoMinerTimer = undefined;
        }
    }
    async sealBlocks() {
        if (this.blocks.length === 0) {
            return null;
        }
        const fromHeight = this.blocks[0].height;
        const toHeight = this.blocks[this.blocks.length - 1].height;
        const timestamp = Date.now();
        const concatenated = this.blocks.map((block) => block.blockHash).join("|");
        const sealHash = await sha256Hex(hashString(concatenated));
        const archive = {
            fromHeight,
            toHeight,
            blockCount: this.blocks.length,
            sealHash,
            timestamp,
        };
        this.sealed.push(archive);
        this.blocks = [];
        return archive;
    }
    getBlocks() {
        // If block store is enabled, return blocks from store's memory cache
        if (this.blockStore && this.blockStoreReady) {
            return this.blockStore.getBlocksInMemory();
        }
        return [...this.blocks];
    }
    /**
     * Import blocks into the VM block store or memory.
     * Note: This does NOT apply state transitions; use snapshots or replay for state.
     */
    async importBlocks(blocks, options = {}) {
        if (blocks.length === 0) {
            return 0;
        }
        const ordered = [...blocks].sort((a, b) => a.height - b.height);
        if (this.blockStore && this.blockStoreReady) {
            for (const block of ordered) {
                await this.blockStore.addBlock(block);
            }
            this.blocks = this.blockStore.getBlocksInMemory();
            return ordered.length;
        }
        if (options.storeOnly) {
            throw new Error("Block store is not enabled.");
        }
        this.blocks = ordered.slice(-this.maxBlocksInMemory);
        return ordered.length;
    }
    /**
     * Get a block by height (async for block store access).
     */
    async getBlockByHeight(height) {
        if (this.blockStore && this.blockStoreReady) {
            return this.blockStore.getBlock(height);
        }
        return this.blocks.find((item) => item.height === height) ?? null;
    }
    /**
     * Get a block by hash (async for block store access).
     */
    async getBlockByHash(hash) {
        if (this.blockStore && this.blockStoreReady) {
            return this.blockStore.getBlockByHash(hash);
        }
        return this.blocks.find((item) => item.blockHash === hash) ?? null;
    }
    getSealedArchives() {
        return [...this.sealed];
    }
    getBlockHeader(height) {
        const block = this.blocks.find((item) => item.height === height);
        return block ? block.header : null;
    }
    /**
     * Get block header by height (async for block store access).
     */
    async getBlockHeaderAsync(height) {
        if (this.blockStore && this.blockStoreReady) {
            return this.blockStore.getHeader(height);
        }
        const block = this.blocks.find((item) => item.height === height);
        return block ? block.header : null;
    }
    estimateFee(bytes) {
        return this.feePolicy.baseFee + this.feePolicy.perByteFee * BigInt(bytes);
    }
    getFeePolicy() {
        return this.feePolicy;
    }
    estimateGas(bytes) {
        return bytes * this.gasPolicy.gasPerByte;
    }
    getGasPolicy() {
        return this.gasPolicy;
    }
    isPqSignatureRequired() {
        return this.requirePqSignature;
    }
    async verifyPqSignature(messageHex, signatureBase64, publicKeyHex, algorithm) {
        if (!this.pqVerifier) {
            return false;
        }
        return this.pqVerifier(messageHex, signatureBase64, publicKeyHex, algorithm);
    }
    chargeFeeOrThrow(callerDid, bytes) {
        const storage = this.hostOptions.storage;
        if (!storage) {
            return;
        }
        const fee = this.estimateFee(bytes);
        const key = `native:astra:balance:${callerDid}`;
        const keyBytes = new TextEncoder().encode(key);
        const current = storage.get(keyBytes);
        let balance = 0n;
        if (current && current.length >= 8) {
            const view = new DataView(current.buffer, current.byteOffset, current.byteLength);
            balance = view.getBigUint64(0, true);
        }
        if (balance < fee) {
            throw new Error("Insufficient ASTRA balance for fee");
        }
        const next = balance - fee;
        const out = new ArrayBuffer(8);
        new DataView(out).setBigUint64(0, next, true);
        storage.set(keyBytes, new Uint8Array(out));
        const treasuryKey = `native:astra:balance:${this.treasuryDid}`;
        const treasuryBytes = new TextEncoder().encode(treasuryKey);
        const existing = storage.get(treasuryBytes);
        let treasuryBalance = 0n;
        if (existing && existing.length >= 8) {
            const view = new DataView(existing.buffer, existing.byteOffset, existing.byteLength);
            treasuryBalance = view.getBigUint64(0, true);
        }
        const treasuryNext = treasuryBalance + fee;
        const treasuryOut = new ArrayBuffer(8);
        new DataView(treasuryOut).setBigUint64(0, treasuryNext, true);
        storage.set(treasuryBytes, new Uint8Array(treasuryOut));
    }
    transferValueOrThrow(callerDid, contractId, value) {
        if (value <= 0n) {
            return;
        }
        const storage = this.hostOptions.storage;
        if (!storage) {
            throw new Error("Storage not ready for value transfer");
        }
        const callerKey = `native:astra:balance:${callerDid}`;
        const callerBytes = new TextEncoder().encode(callerKey);
        const existing = storage.get(callerBytes);
        let callerBalance = 0n;
        if (existing && existing.length >= 8) {
            callerBalance = new DataView(existing.buffer, existing.byteOffset, existing.byteLength).getBigUint64(0, true);
        }
        if (callerBalance < value) {
            throw new Error("Insufficient ASTRA balance for value");
        }
        const contractDid = `did:spacekit:contract:${contractId}`;
        const contractKey = `native:astra:balance:${contractDid}`;
        const contractBytes = new TextEncoder().encode(contractKey);
        const contractExisting = storage.get(contractBytes);
        let contractBalance = 0n;
        if (contractExisting && contractExisting.length >= 8) {
            contractBalance = new DataView(contractExisting.buffer, contractExisting.byteOffset, contractExisting.byteLength).getBigUint64(0, true);
        }
        const callerNext = callerBalance - value;
        const callerOut = new ArrayBuffer(8);
        new DataView(callerOut).setBigUint64(0, callerNext, true);
        storage.set(callerBytes, new Uint8Array(callerOut));
        const contractNext = contractBalance + value;
        const contractOut = new ArrayBuffer(8);
        new DataView(contractOut).setBigUint64(0, contractNext, true);
        storage.set(contractBytes, new Uint8Array(contractOut));
    }
    getStorageValue(keyHex) {
        const storage = this.hostOptions.storage;
        if (!storage) {
            return null;
        }
        const keyBytes = hexToBytes(keyHex);
        return storage.get(keyBytes) ?? null;
    }
    setStorageValueWithAux(keyHex, valueHex, auxHex) {
        const storage = this.hostOptions.storage;
        if (!storage) {
            return;
        }
        const keyBytes = hexToBytes(strip0x(keyHex));
        const valueBytes = hexToBytes(strip0x(valueHex));
        storage.set(keyBytes, valueBytes);
        if (auxHex && storage.setAux) {
            storage.setAux(keyBytes, hexToBytes(strip0x(auxHex)));
        }
    }
    getNonce(did) {
        return this.nonceByDid.get(did) ?? 0;
    }
    bumpNonce(did) {
        const next = this.getNonce(did) + 1;
        this.nonceByDid.set(did, next);
        return next;
    }
    getTransaction(txId) {
        return this.txIndex.get(txId);
    }
    getReceipt(txId) {
        return this.receiptIndex.get(txId);
    }
    async getStateProof(keyHex) {
        const storage = this.hostOptions.storage;
        const keyBytes = hexToBytes(keyHex);
        const value = storage?.get(keyBytes);
        const valueHex = value ? bytesToHex(value) : null;
        const { root, proof } = await this.computeStateProof(keyHex);
        const stateRoot = root;
        const proofPayload = `${keyHex}:${valueHex ?? "null"}:${stateRoot}:${proof.length}`;
        const proofHash = await sha256Hex(hashString(proofPayload));
        return {
            keyHex,
            valueHex,
            stateRoot,
            proofHash,
            proof,
        };
    }
    async getQuantumStateProof(keyHex) {
        await this.initQuantumVerkle();
        if (!this.quantumVerkle) {
            throw new Error("Quantum Verkle not initialized");
        }
        const storage = this.hostOptions.storage;
        if (!storage) {
            throw new Error("Storage not available");
        }
        const entries = buildQuantumEntries(storage);
        const proof = await this.quantumVerkle.computeProof(entries, keyHex);
        return {
            ...proof,
            verkleScheme: "SIS-WeeWu",
        };
    }
    async getTxProof(txId) {
        // Get blocks from store or memory
        const blocks = this.blockStore && this.blockStoreReady
            ? this.blockStore.getBlocksInMemory()
            : this.blocks;
        for (const block of blocks) {
            const index = block.transactions.findIndex((tx) => tx.id === txId);
            if (index === -1) {
                continue;
            }
            const tx = block.transactions[index];
            const txHash = await hashTransaction(tx);
            const txHashes = await Promise.all(block.transactions.map((item) => hashTransaction(item)));
            const { proof } = await merkleProof(txHashes, index);
            return {
                txId,
                txHash,
                txRoot: block.txRoot,
                index,
                blockHash: block.blockHash,
                blockHeight: block.height,
                proof,
            };
        }
        return null;
    }
    async getReceiptProof(txId) {
        // Get blocks from store or memory
        const blocks = this.blockStore && this.blockStoreReady
            ? this.blockStore.getBlocksInMemory()
            : this.blocks;
        for (const block of blocks) {
            const index = block.receipts.findIndex((receipt) => receipt.txId === txId);
            if (index === -1) {
                continue;
            }
            const receipt = block.receipts[index];
            const receiptHashes = block.receipts.map((item) => item.receiptHash);
            const { proof } = await merkleProof(receiptHashes, index);
            return {
                txId,
                receiptHash: receipt.receiptHash,
                receiptRoot: block.receiptRoot,
                index,
                blockHash: block.blockHash,
                blockHeight: block.height,
                proof,
            };
        }
        return null;
    }
    async createSnapshot() {
        const storage = this.hostOptions.storage;
        if (!storage || !storage.entries) {
            return { stateRoot: "state:empty", quantumStateRoot: "verkle:empty", entries: [], timestamp: Date.now() };
        }
        const entries = storage.entries().map((entry) => ({
            keyHex: bytesToHex(entry.key),
            valueHex: bytesToHex(entry.value),
        }));
        entries.sort((a, b) => a.keyHex.localeCompare(b.keyHex));
        const stateRoot = await this.computeStateRoot();
        const quantumStateRoot = await this.computeQuantumStateRoot();
        return { stateRoot, quantumStateRoot, entries, timestamp: Date.now() };
    }
    restoreSnapshot(snapshot) {
        const storage = this.hostOptions.storage;
        if (!storage) {
            return;
        }
        if (storage.clear) {
            storage.clear();
        }
        for (const entry of snapshot.entries) {
            storage.set(hexToBytes(entry.keyHex), hexToBytes(entry.valueHex));
        }
    }
    applySnapshotDelta(entries) {
        const storage = this.hostOptions.storage;
        if (!storage) {
            return;
        }
        for (const entry of entries) {
            storage.set(hexToBytes(entry.keyHex), hexToBytes(entry.valueHex));
        }
    }
    async computeStateRoot() {
        const storage = this.hostOptions.storage;
        if (!storage || !storage.entries) {
            return "state:empty";
        }
        const entries = storage.entries();
        const pairs = entries.map((entry) => ({
            key: bytesToHex(entry.key),
            value: bytesToHex(entry.value),
        }));
        pairs.sort((a, b) => a.key.localeCompare(b.key));
        const leaves = pairs.map((pair) => `${pair.key}:${pair.value}`);
        return merkleRoot(leaves);
    }
    async computeQuantumStateRoot() {
        try {
            await this.initQuantumVerkle();
        }
        catch (error) {
            return "verkle:init-failed";
        }
        if (!this.quantumVerkle) {
            return "verkle:disabled";
        }
        const storage = this.hostOptions.storage;
        if (!storage) {
            return "verkle:empty";
        }
        const entries = buildQuantumEntries(storage);
        return this.quantumVerkle.computeRoot(entries);
    }
    async computeStateProof(keyHex) {
        const storage = this.hostOptions.storage;
        if (!storage || !storage.entries) {
            return { root: "state:empty", proof: [] };
        }
        const entries = storage.entries();
        const pairs = entries.map((entry) => ({
            key: bytesToHex(entry.key),
            value: bytesToHex(entry.value),
        }));
        pairs.sort((a, b) => a.key.localeCompare(b.key));
        const leaves = pairs.map((pair) => `${pair.key}:${pair.value}`);
        const index = pairs.findIndex((pair) => pair.key === keyHex);
        if (index === -1) {
            return { root: await merkleRoot(leaves), proof: [] };
        }
        return merkleProof(leaves, index);
    }
}
async function hashTransaction(tx) {
    const payload = {
        id: tx.id,
        contractId: tx.contractId,
        callerDid: tx.callerDid,
        input: bytesToHex(tx.input),
        value: tx.value.toString(),
        timestamp: tx.timestamp,
    };
    return sha256Hex(hashString(JSON.stringify(payload)));
}
async function hashReceipt(receipt) {
    const payload = {
        txId: receipt.txId,
        contractId: receipt.contractId,
        status: receipt.status,
        result: bytesToHex(receipt.result),
        events: receipt.events.map((event) => ({
            type: event.type,
            data: bytesToHex(event.data),
        })),
        timestamp: receipt.timestamp,
        gasUsed: receipt.gasUsed ?? 0,
    };
    return sha256Hex(hashString(JSON.stringify(payload)));
}
function strip0x(value) {
    if (!value) {
        return value;
    }
    return value.startsWith("0x") ? value.slice(2) : value;
}
async function hashList(values) {
    if (values.length === 0) {
        return "hash:empty";
    }
    return sha256Hex(hashString(values.join("|")));
}
