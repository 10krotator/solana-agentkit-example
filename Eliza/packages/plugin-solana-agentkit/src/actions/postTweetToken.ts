import {
    Action,
    elizaLogger,
    IAgentRuntime,
    Memory,
    HandlerCallback,
} from "@elizaos/core";
import { SolanaAgentKit } from "solana-agent-kit";

export default {
    name: "POST_TWEET_TOKEN",
    description: "Mint a token after each tweet",
    validate: async (_runtime: IAgentRuntime, _message: Memory) => true,
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        _state,
        _options,
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting POST_TWEET_TOKEN handler...");

        try {
            const solanaPrivatekey = runtime.getSetting("SOLANA_PRIVATE_KEY");
            const rpc = runtime.getSetting("SOLANA_RPC_URL");
            const openAIKey = runtime.getSetting("OPENAI_API_KEY");

            const solanaAgentKit = new SolanaAgentKit(
                solanaPrivatekey,
                rpc,
                openAIKey
            );

            // Generate token details based on the tweet
            const tweetText = message.content.text;
            const timestamp = new Date().getTime();

            const tokenDetails = {
                name: `Tweet Token ${timestamp}`,
                symbol: "TWEET",
                uri:
                    runtime.getSetting("DEFAULT_NFT_METADATA_URI") ||
                    "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/CompressedCoil/metadata.json",
                decimals: 9,
            };

            const deployedAddress = await solanaAgentKit.deployToken(
                tokenDetails.name,
                tokenDetails.uri,
                tokenDetails.symbol,
                tokenDetails.decimals
            );

            if (callback) {
                // Return text-only response without media requirement
                callback({
                    text: `Minted token for tweet: ${deployedAddress}`,
                    content: {
                        success: true,
                        deployedAddress,
                        tokenDetails,
                        skipMedia: true, // Signal to Twitter client to skip media requirement
                    },
                });
            }
            return true;
        } catch (error) {
            elizaLogger.error("Error minting post-tweet token:", error);
            if (callback) {
                callback({
                    text: `Failed to mint token: ${error.message}`,
                    content: {
                        error: error.message,
                        skipMedia: true, // Also skip media on error
                    },
                });
            }
            return false;
        }
    },
} as Action;
