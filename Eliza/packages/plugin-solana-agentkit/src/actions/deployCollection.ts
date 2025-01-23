import {
    Action,
    elizaLogger,
    IAgentRuntime,
    Memory,
    HandlerCallback,
    generateObjectDeprecated,
    composeContext,
    ModelClass,
} from "@elizaos/core";
import { SolanaAgentKit } from "solana-agent-kit";
import { z } from "zod";

// Schema for collection parameters
const collectionSchema = z.object({
    name: z.string().min(1, "Name is required"),
    uri: z.string().url("URI must be a valid URL"),
    royaltyBasisPoints: z.number().min(0).max(10000).optional(),
    creators: z
        .array(
            z.object({
                address: z.string(),
                percentage: z.number().min(0).max(100),
            })
        )
        .optional(),
});

// Template for extracting collection details from messages
const collectionTemplate = `
Extract the NFT collection details from this message in JSON format.
Message: "{{message.content.text}}"
Rules:
- Name: Full collection name
- URI: Must be a complete metadata JSON URL that contains:
  * name
  * description
  * image URL
  * attributes/properties
  Example URI: "https://arweave.net/[hash]/metadata.json" or "https://gateway.pinata.cloud/ipfs/[hash]"
- Royalty Basis Points: A number between 0-10000 (500 = 5%)
- Creators: Array of objects with 'address' and 'percentage'

If no URI is specified, use this default metadata URI:
"https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/CompressedCoil/metadata.json"

Example Response:
\`\`\`json
{
    "name": "My NFT Collection",
    "uri": "https://arweave.net/123abc/metadata.json",
    "royaltyBasisPoints": 500,
    "creators": [
        { "address": "SOLANA_ADDRESS", "percentage": 100 }
    ]
}
\`\`\`

If any required field is missing, use these defaults:
- royaltyBasisPoints: 500 (5%)
- creators: [{ "address": "<wallet_address>", "percentage": 100 }]
`;

// Add metadata validation
const validateMetadataUri = async (uri: string): Promise<boolean> => {
    try {
        const response = await fetch(uri);
        const metadata = await response.json();
        return !!(metadata.name && metadata.description && metadata.image);
    } catch (error) {
        elizaLogger.error("Invalid metadata URI:", error);
        return false;
    }
};

export default {
    name: "DEPLOY_COLLECTION",
    description: "Deploy a new NFT collection on Solana blockchain",
    similes: [
        "create collection",
        "launch collection",
        "deploy nft collection",
        "create nft collection",
        "mint collection",
    ],
    validate: async (_runtime: IAgentRuntime, _message: Memory) => true,
    handler: async (
        runtime: IAgentRuntime,
        message: Memory,
        state,
        _options,
        callback?: HandlerCallback
    ): Promise<boolean> => {
        elizaLogger.log("Starting DEPLOY_COLLECTION handler...");

        try {
            // Add validation for empty content
            if (!message.content.text && !message.content.source) {
                elizaLogger.error("Empty message content");
                if (callback) {
                    callback({
                        text: "Cannot process empty message content",
                        content: { error: "Empty message content" },
                    });
                }
                return false;
            }

            // Add fallback for missing user data
            const userMetrics = (await runtime.databaseAdapter.getMetrics(
                message.userId
            )) || {
                defaultRoyalty: 500,
                defaultCreator: runtime.getSetting("SOLANA_PUBLIC_KEY"),
            };

            // Extract parameters from message
            const context = composeContext({
                state,
                template: collectionTemplate,
            });

            const params = await generateObjectDeprecated({
                runtime,
                context,
                modelClass: ModelClass.LARGE,
            });

            // Validate parameters
            const validatedParams = collectionSchema.parse(params);

            // Add metadata validation
            if (
                !validatedParams.uri ||
                !(await validateMetadataUri(validatedParams.uri))
            ) {
                elizaLogger.warn(
                    "Invalid or missing metadata URI, using default"
                );
                validatedParams.uri =
                    runtime.getSetting("DEFAULT_NFT_METADATA_URI") ||
                    "https://raw.githubusercontent.com/solana-developers/opos-asset/main/assets/CompressedCoil/metadata.json";
            }

            // Initialize Solana Agent Kit
            const solanaPrivatekey = runtime.getSetting("SOLANA_PRIVATE_KEY");
            const rpc = runtime.getSetting("SOLANA_RPC_URL");
            const openAIKey = runtime.getSetting("OPENAI_API_KEY");

            const solanaAgentKit = new SolanaAgentKit(
                solanaPrivatekey,
                rpc,
                openAIKey
            );

            // Deploy collection
            const result = await solanaAgentKit.deployCollection({
                name: validatedParams.name,
                uri: validatedParams.uri,
                royaltyBasisPoints: validatedParams.royaltyBasisPoints || 500,
                creators: validatedParams.creators || [
                    {
                        address: solanaAgentKit.wallet_address.toString(),
                        percentage: 100,
                    },
                ],
            });

            if (callback) {
                callback({
                    text: `Successfully deployed NFT collection "${validatedParams.name}"! Collection address: ${result.collectionAddress}`,
                    content: {
                        success: true,
                        collectionAddress: result.collectionAddress.toString(),
                        name: validatedParams.name,
                        signature: result.signature,
                    },
                });
            }

            return true;
        } catch (error) {
            elizaLogger.error("Error deploying collection:", error);
            if (callback) {
                callback({
                    text: `Failed to deploy collection: ${error.message}`,
                    content: { error: error.message },
                });
            }
            return false;
        }
    },
} as Action;
