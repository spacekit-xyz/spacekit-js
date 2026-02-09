import { callSpacekitMain } from "../runtime.js";
const OP_MINT = 1;
const OP_TRANSFER = 2;
const OP_BALANCE = 3;
const OP_TOTAL_SUPPLY = 4;
const OP_METADATA = 5;
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
function decodeString(bytes, offset) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset, bytes.byteLength - offset);
    const len = view.getUint16(0, true);
    const start = offset + 2;
    const end = start + len;
    const slice = bytes.slice(start, end);
    const value = new TextDecoder().decode(slice);
    return { value, next: end };
}
export class SkErc20Client {
    ctx;
    instance;
    constructor(ctx, instance) {
        this.ctx = ctx;
        this.instance = instance;
    }
    mint(toDid, amount) {
        const payload = concat([
            Uint8Array.of(OP_MINT),
            encodeString(toDid),
            encodeU64(amount),
        ]);
        const { status } = callSpacekitMain(this.ctx, this.instance, payload);
        return status > 0;
    }
    transfer(fromDid, toDid, amount) {
        const payload = concat([
            Uint8Array.of(OP_TRANSFER),
            encodeString(fromDid),
            encodeString(toDid),
            encodeU64(amount),
        ]);
        const { status } = callSpacekitMain(this.ctx, this.instance, payload);
        return status > 0;
    }
    balanceOf(did) {
        const payload = concat([Uint8Array.of(OP_BALANCE), encodeString(did)]);
        const { status, result } = callSpacekitMain(this.ctx, this.instance, payload);
        if (status <= 0 || result.length < 8) {
            return 0n;
        }
        return decodeU64(result);
    }
    totalSupply() {
        const payload = Uint8Array.of(OP_TOTAL_SUPPLY);
        const { status, result } = callSpacekitMain(this.ctx, this.instance, payload);
        if (status <= 0 || result.length < 8) {
            return 0n;
        }
        return decodeU64(result);
    }
    metadata() {
        const payload = Uint8Array.of(OP_METADATA);
        const { status, result } = callSpacekitMain(this.ctx, this.instance, payload);
        if (status <= 0 || result.length < 1) {
            return { version: 0, name: "", symbol: "", decimals: 0 };
        }
        let offset = 0;
        const version = result[offset];
        offset += 1;
        const nameDecoded = decodeString(result, offset);
        offset = nameDecoded.next;
        const symbolDecoded = decodeString(result, offset);
        offset = symbolDecoded.next;
        const decimals = result[offset] ?? 0;
        return {
            version,
            name: nameDecoded.value,
            symbol: symbolDecoded.value,
            decimals,
        };
    }
}
