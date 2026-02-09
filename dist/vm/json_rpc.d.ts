import { SpacekitVm } from "./spacekitvm.js";
export interface JsonRpcRequest {
    jsonrpc?: "2.0";
    id?: string | number | null;
    method: string;
    params?: Record<string, unknown>;
}
export interface JsonRpcResponse {
    jsonrpc: "2.0";
    id: string | number | null;
    result?: unknown;
    error?: {
        code: number;
        message: string;
    };
}
export declare function createJsonRpcHandler(vm: SpacekitVm): (request: JsonRpcRequest | string) => Promise<JsonRpcResponse>;
