const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
export class MemoryView {
    memory;
    constructor(memory) {
        this.memory = memory;
    }
    setMemory(memory) {
        this.memory = memory;
    }
    readBytes(ptr, len) {
        const view = new Uint8Array(this.memory.buffer);
        return view.slice(ptr, ptr + len);
    }
    writeBytes(ptr, data) {
        const view = new Uint8Array(this.memory.buffer);
        view.set(data, ptr);
    }
    readString(ptr, len) {
        if (len <= 0) {
            return "";
        }
        return textDecoder.decode(this.readBytes(ptr, len));
    }
    writeString(ptr, value) {
        const data = textEncoder.encode(value);
        this.writeBytes(ptr, data);
        return data.length;
    }
}
export class LinearMemoryAllocator {
    memory;
    offset = 0;
    constructor(memory) {
        this.memory = memory;
        this.offset = memory.buffer.byteLength;
    }
    setMemory(memory) {
        this.memory = memory;
        this.offset = memory.buffer.byteLength;
    }
    alloc(size) {
        const aligned = (size + 7) & ~7;
        const ptr = this.offset;
        const next = ptr + aligned;
        if (next > this.memory.buffer.byteLength) {
            const pagesNeeded = Math.ceil((next - this.memory.buffer.byteLength) / 65536);
            this.memory.grow(pagesNeeded);
        }
        this.offset = next;
        return ptr;
    }
}
