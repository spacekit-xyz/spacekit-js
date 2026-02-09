export declare class MemoryView {
    private memory;
    constructor(memory: WebAssembly.Memory);
    setMemory(memory: WebAssembly.Memory): void;
    readBytes(ptr: number, len: number): Uint8Array;
    writeBytes(ptr: number, data: Uint8Array): void;
    readString(ptr: number, len: number): string;
    writeString(ptr: number, value: string): number;
}
export declare class LinearMemoryAllocator {
    private memory;
    private offset;
    constructor(memory: WebAssembly.Memory);
    setMemory(memory: WebAssembly.Memory): void;
    alloc(size: number): number;
}
