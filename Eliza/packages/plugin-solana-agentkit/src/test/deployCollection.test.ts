import { expect, test } from "vitest";
import { IAgentRuntime } from "@elizaos/core";
import deployCollection from "../actions/deployCollection";

test("Deploy NFT Collection", async () => {
    // Mock message
    const testMessage = {
        content: {
            text: `Create an NFT collection called "Test Collection" with metadata at https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/CompressedCoil/metadata.json and 5% royalties`,
        },
        roomId: "test-room",
        userId: "test-user",
    };

    // Mock runtime with required settings
    const mockRuntime: Partial<IAgentRuntime> = {
        getSetting: (key: string) => {
            switch (key) {
                case "SOLANA_PRIVATE_KEY":
                    return process.env.SOLANA_PRIVATE_KEY;
                case "SOLANA_RPC_URL":
                    return process.env.SOLANA_RPC_URL;
                case "OPENAI_API_KEY":
                    return process.env.OPENAI_API_KEY;
                default:
                    return "";
            }
        },
    };

    // Test callback
    let callbackResult: any;
    const callback = (result: any) => {
        callbackResult = result;
        console.log("Deployment result:", result);
    };

    const result = await deployCollection.handler(
        mockRuntime as IAgentRuntime,
        testMessage as any,
        {},
        {},
        callback
    );

    expect(result).toBe(true);
    expect(callbackResult.content.success).toBe(true);
    expect(callbackResult.content.collectionAddress).toBeDefined();
});
