import http from "node:http";
import type { SpacekitVm } from "./spacekitvm.js";
export interface RpcServerOptions {
    port?: number;
    host?: string;
    rateLimit?: {
        windowMs: number;
        maxRequests: number;
    };
    allowlist?: string[];
    apiKey?: string;
}
export declare function startJsonRpcServer(vm: SpacekitVm, options?: RpcServerOptions): http.Server<typeof http.IncomingMessage, typeof http.ServerResponse>;
