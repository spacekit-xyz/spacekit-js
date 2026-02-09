export function createVmContractCaller(vm, options) {
    const mode = options.mode ?? "execute";
    const value = options.value ?? 0n;
    return async function callContract(contractId, method, args) {
        const input = options.codec.encode(method, args);
        if (mode === "submit") {
            await vm.submitTransaction(contractId, input, options.callerDid, value);
            return options.codec.decode(method, new Uint8Array());
        }
        const receipt = await vm.executeTransaction(contractId, input, options.callerDid, value);
        if (receipt.status <= 0) {
            throw new Error(`Contract call failed: ${receipt.status}`);
        }
        return options.codec.decode(method, receipt.result);
    };
}
export const JsonContractCodec = {
    encode(method, args) {
        const payload = JSON.stringify({ method, args });
        return new TextEncoder().encode(payload);
    },
    decode(_method, output) {
        if (!output || output.length === 0) {
            return undefined;
        }
        const text = new TextDecoder().decode(output);
        try {
            return JSON.parse(text);
        }
        catch {
            return text;
        }
    },
};
