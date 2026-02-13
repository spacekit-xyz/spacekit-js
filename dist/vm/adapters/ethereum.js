/**
 * Ethereum proof-bridge adapter. Optional dependency: viem.
 * Submits state roots and bundle hashes to an L1 contract.
 */
const CHAIN_ID_PREFIX = "ethereum";
function hexToBytes32(hex) {
    const h = hex.startsWith("0x") ? hex.slice(2) : hex;
    const padded = h.padStart(64, "0").slice(0, 64);
    return `0x${padded}`;
}
function createStubAdapter(chainId, reason) {
    return {
        chainId,
        isReady: () => false,
        async submit() {
            return { success: false, error: reason };
        },
    };
}
export async function createEthereumAdapter(config) {
    if (!config.chainId.toLowerCase().startsWith(CHAIN_ID_PREFIX) || !config.enabled)
        return null;
    if (!config.rpcUrl || !config.contractAddress)
        return null;
    let viem;
    let viemAccounts;
    try {
        viem = await import("viem");
        viemAccounts = await import("viem/accounts");
    }
    catch {
        return createStubAdapter(config.chainId, "viem not installed");
    }
    const createWalletClient = viem.createWalletClient;
    const createPublicClient = viem.createPublicClient;
    const http = viem.http;
    const encodeFunctionData = viem.encodeFunctionData;
    const chain = config.chainId.toLowerCase().includes("sepolia") ? viem.sepolia : viem.mainnet;
    const transport = http(config.rpcUrl);
    const publicClient = createPublicClient({ transport, chain });
    let walletClient = null;
    let account;
    if (config.privateKeyHex) {
        const pk = (config.privateKeyHex.startsWith("0x") ? config.privateKeyHex : `0x${config.privateKeyHex}`);
        const acc = viemAccounts.privateKeyToAccount(pk);
        walletClient = createWalletClient({ account: acc, transport, chain });
        account = acc.address;
    }
    const contractAddress = config.contractAddress;
    const gasLimit = config.gasLimit != null ? BigInt(config.gasLimit) : 200000n;
    const adapter = {
        chainId: config.chainId,
        isReady: () => true,
        async submit(payload) {
            try {
                if (payload.kind === "state_root") {
                    const stateRootBytes = hexToBytes32(payload.stateRoot);
                    const blockNum = BigInt(payload.blockHeight);
                    if (!walletClient || !account)
                        return { success: false, error: "no wallet configured" };
                    const data = encodeFunctionData({
                        abi: [
                            {
                                type: "function",
                                name: "commitStateRoot",
                                stateMutability: "nonpayable",
                                inputs: [
                                    { name: "blockNumber", type: "uint256" },
                                    { name: "stateRoot", type: "bytes32" },
                                ],
                            },
                        ],
                        functionName: "commitStateRoot",
                        args: [blockNum, stateRootBytes],
                    });
                    const hash = await walletClient.sendTransaction({
                        to: contractAddress,
                        data,
                        gas: gasLimit,
                        account,
                    });
                    const receipt = await publicClient.waitForTransactionReceipt({ hash });
                    return receipt.status === "success"
                        ? { success: true, id: hash }
                        : { success: false, error: "reverted" };
                }
                if (payload.kind === "bundle" || payload.kind === "signed_bundle") {
                    const bundleHash = payload.kind === "bundle" ? payload.bundle.bundleHash : payload.signed.bundleHash;
                    const bundleHashBytes = hexToBytes32(bundleHash);
                    if (!walletClient || !account)
                        return { success: false, error: "no wallet configured" };
                    const data = encodeFunctionData({
                        abi: [
                            {
                                type: "function",
                                name: "commitBundle",
                                stateMutability: "nonpayable",
                                inputs: [{ name: "bundleHash", type: "bytes32" }],
                            },
                        ],
                        functionName: "commitBundle",
                        args: [bundleHashBytes],
                    });
                    const hash = await walletClient.sendTransaction({
                        to: contractAddress,
                        data,
                        gas: gasLimit,
                        account,
                    });
                    const receipt = await publicClient.waitForTransactionReceipt({ hash });
                    return receipt.status === "success"
                        ? { success: true, id: hash }
                        : { success: false, error: "reverted" };
                }
                return { success: false, error: "unsupported payload kind" };
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                return { success: false, error: msg };
            }
        },
    };
    return adapter;
}
