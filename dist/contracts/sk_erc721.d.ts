import type { HostContext } from "../host.js";
export declare class SkErc721Client {
    private ctx;
    private instance;
    constructor(ctx: HostContext, instance: WebAssembly.Instance);
    mint(tokenId: bigint, ownerDid: string): boolean;
    transfer(tokenId: bigint, fromDid: string, toDid: string): boolean;
    ownerOf(tokenId: bigint): string;
    setTokenUri(tokenId: bigint, uri: string): boolean;
    tokenUri(tokenId: bigint): string;
    totalSupply(): bigint;
}
