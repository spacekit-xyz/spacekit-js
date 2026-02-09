import { verifyComputeNodeReceiptProof, verifyComputeNodeTxProof, verifyComputeNodeQuantumStateProof } from "./light_client.js";
export class HeaderSyncClient {
    rpcUrl;
    fetcher;
    quantumVerkle;
    constructor(options) {
        this.rpcUrl = options.rpcUrl;
        this.fetcher = options.fetcher ?? fetch;
        this.quantumVerkle = options.quantumVerkle ?? {};
    }
    async getLatestHeight() {
        const blocks = await this.rpcCall("vm_blocks", {});
        if (!blocks || blocks.length === 0) {
            return 0;
        }
        return blocks[blocks.length - 1].height ?? 0;
    }
    async getChainId() {
        try {
            const response = await this.rpcCall("vm_chainId", {});
            return response?.chainId ?? null;
        }
        catch {
            return null;
        }
    }
    async getHeader(height) {
        return this.rpcCall("vm_blockHeader", { height });
    }
    async syncHeaders(fromHeight = 1, toHeight) {
        const latestHeight = toHeight ?? (await this.getLatestHeight());
        const headers = [];
        let prevHash = "genesis";
        for (let height = fromHeight; height <= latestHeight; height += 1) {
            const header = await this.getHeader(height);
            if (!header) {
                throw new Error(`Missing header at height ${height}`);
            }
            if (height > 1 && header.prevHash !== prevHash) {
                throw new Error(`Header chain mismatch at height ${height}`);
            }
            headers.push(header);
            prevHash = header.blockHash;
        }
        return { headers, latestHeight };
    }
    async verifyReceiptProof(proof, header) {
        const headerLike = header
            ? {
                blockHash: header.blockHash,
                txRoot: header.txRoot,
                receiptRoot: header.receiptRoot,
                stateRoot: header.stateRoot,
                quantumStateRoot: header.quantumStateRoot,
                height: header.height,
            }
            : undefined;
        return verifyComputeNodeReceiptProof(proof, headerLike);
    }
    async verifyTxProof(proof, header) {
        const headerLike = header
            ? {
                blockHash: header.blockHash,
                txRoot: header.txRoot,
                receiptRoot: header.receiptRoot,
                stateRoot: header.stateRoot,
                quantumStateRoot: header.quantumStateRoot,
                height: header.height,
            }
            : undefined;
        return verifyComputeNodeTxProof(proof, headerLike);
    }
    async getQuantumStateRoot() {
        const response = await this.rpcCall("vm_quantumStateRoot", {});
        return response?.root ?? "verkle:unknown";
    }
    async getQuantumStateProof(keyHex) {
        return this.rpcCall("vm_quantumStateProof", { keyHex });
    }
    async verifyQuantumStateProof(proof, header) {
        const headerLike = header
            ? {
                blockHash: header.blockHash,
                txRoot: header.txRoot,
                receiptRoot: header.receiptRoot,
                stateRoot: header.stateRoot,
                quantumStateRoot: header.quantumStateRoot,
                height: header.height,
            }
            : undefined;
        return verifyComputeNodeQuantumStateProof(proof, headerLike, this.quantumVerkle);
    }
    async rpcCall(method, params) {
        const response = await this.fetcher(this.rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: Date.now(),
                method,
                params,
            }),
        });
        if (!response.ok) {
            throw new Error(`RPC ${method} failed with ${response.status}`);
        }
        const payload = await response.json();
        if (payload.error) {
            throw new Error(payload.error?.message ?? `RPC ${method} error`);
        }
        return payload.result;
    }
}
