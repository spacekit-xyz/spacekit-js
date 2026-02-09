import { callSpacekitMain } from "../runtime.js";
const OP_MINT = 1;
const OP_TRANSFER = 2;
const OP_OWNER_OF = 3;
const OP_SET_TOKEN_URI = 4;
const OP_TOKEN_URI = 5;
const OP_TOTAL_SUPPLY = 6;
function concat(parts) {
    const total = parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}
function encodeU16(value) {
    const buffer = new ArrayBuffer(2);
    new DataView(buffer).setUint16(0, value, true);
    return new Uint8Array(buffer);
}
function encodeU64(value) {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigUint64(0, value, true);
    return new Uint8Array(buffer);
}
function encodeString(value) {
    const data = new TextEncoder().encode(value);
    return concat([encodeU16(data.length), data]);
}
function decodeU64(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return view.getBigUint64(0, true);
}
export class SkErc721Client {
    ctx;
    instance;
    constructor(ctx, instance) {
        this.ctx = ctx;
        this.instance = instance;
    }
    mint(tokenId, ownerDid) {
        const payload = concat([
            Uint8Array.of(OP_MINT),
            encodeU64(tokenId),
            encodeString(ownerDid),
        ]);
        const { status } = callSpacekitMain(this.ctx, this.instance, payload);
        return status > 0;
    }
    transfer(tokenId, fromDid, toDid) {
        const payload = concat([
            Uint8Array.of(OP_TRANSFER),
            encodeU64(tokenId),
            encodeString(fromDid),
            encodeString(toDid),
        ]);
        const { status } = callSpacekitMain(this.ctx, this.instance, payload);
        return status > 0;
    }
    ownerOf(tokenId) {
        const payload = concat([Uint8Array.of(OP_OWNER_OF), encodeU64(tokenId)]);
        const { status, result } = callSpacekitMain(this.ctx, this.instance, payload);
        if (status <= 0) {
            return "";
        }
        return new TextDecoder().decode(result);
    }
    setTokenUri(tokenId, uri) {
        const payload = concat([
            Uint8Array.of(OP_SET_TOKEN_URI),
            encodeU64(tokenId),
            encodeString(uri),
        ]);
        const { status } = callSpacekitMain(this.ctx, this.instance, payload);
        return status > 0;
    }
    tokenUri(tokenId) {
        const payload = concat([Uint8Array.of(OP_TOKEN_URI), encodeU64(tokenId)]);
        const { status, result } = callSpacekitMain(this.ctx, this.instance, payload);
        if (status <= 0) {
            return "";
        }
        return new TextDecoder().decode(result);
    }
    totalSupply() {
        const payload = Uint8Array.of(OP_TOTAL_SUPPLY);
        const { status, result } = callSpacekitMain(this.ctx, this.instance, payload);
        if (status <= 0 || result.length < 8) {
            return 0n;
        }
        return decodeU64(result);
    }
}
