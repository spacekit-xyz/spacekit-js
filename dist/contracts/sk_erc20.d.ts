import type { HostContext } from "../host.js";
export interface SkErc20Metadata {
    version: number;
    name: string;
    symbol: string;
    decimals: number;
}
export declare class SkErc20Client {
    private ctx;
    private instance;
    constructor(ctx: HostContext, instance: WebAssembly.Instance);
    mint(toDid: string, amount: bigint): boolean;
    transfer(fromDid: string, toDid: string, amount: bigint): boolean;
    balanceOf(did: string): bigint;
    totalSupply(): bigint;
    metadata(): SkErc20Metadata;
}
