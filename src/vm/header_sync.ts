import type { BlockHeader, QuantumStateProof } from "./spacekitvm.js";
import type { QuantumVerkleOptions } from "./quantum_verkle.js";
import type { ComputeNodeReceiptProof, ComputeNodeTxProof } from "./light_client.js";
import { verifyComputeNodeReceiptProof, verifyComputeNodeTxProof, verifyComputeNodeQuantumStateProof } from "./light_client.js";

export interface HeaderSyncClientOptions {
  rpcUrl: string;
  fetcher?: typeof fetch;
  quantumVerkle?: QuantumVerkleOptions;
}

export type HeaderSyncResult = {
  headers: BlockHeader[];
  latestHeight: number;
};

export class HeaderSyncClient {
  private rpcUrl: string;
  private fetcher: typeof fetch;
  private quantumVerkle: QuantumVerkleOptions;

  constructor(options: HeaderSyncClientOptions) {
    this.rpcUrl = options.rpcUrl;
    this.fetcher = options.fetcher ?? fetch;
    this.quantumVerkle = options.quantumVerkle ?? {};
  }

  async getLatestHeight(): Promise<number> {
    const blocks = await this.rpcCall<BlockHeader[]>("vm_blocks", {});
    if (!blocks || blocks.length === 0) {
      return 0;
    }
    return blocks[blocks.length - 1].height ?? 0;
  }

  async getChainId(): Promise<string | null> {
    try {
      const response = await this.rpcCall<{ chainId: string }>("vm_chainId", {});
      return response?.chainId ?? null;
    } catch {
      return null;
    }
  }

  async getHeader(height: number): Promise<BlockHeader | null> {
    return this.rpcCall<BlockHeader | null>("vm_blockHeader", { height });
  }

  async syncHeaders(fromHeight = 1, toHeight?: number): Promise<HeaderSyncResult> {
    const latestHeight = toHeight ?? (await this.getLatestHeight());
    const headers: BlockHeader[] = [];
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

  async verifyReceiptProof(proof: ComputeNodeReceiptProof, header?: BlockHeader): Promise<boolean> {
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

  async verifyTxProof(proof: ComputeNodeTxProof, header?: BlockHeader): Promise<boolean> {
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

  async getQuantumStateRoot(): Promise<string> {
    const response = await this.rpcCall<{ root: string }>("vm_quantumStateRoot", {});
    return response?.root ?? "verkle:unknown";
  }

  async getQuantumStateProof(keyHex: string): Promise<QuantumStateProof> {
    return this.rpcCall<QuantumStateProof>("vm_quantumStateProof", { keyHex });
  }

  async verifyQuantumStateProof(proof: QuantumStateProof, header?: BlockHeader): Promise<boolean> {
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

  private async rpcCall<T>(method: string, params: Record<string, unknown>): Promise<T> {
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
    return payload.result as T;
  }
}
