import { Plugin } from "@elizaos/core";
import createToken from "./actions/createToken.ts";
import postTweetToken from "./actions/postTweetToken";
import deployCollection from "./actions/deployCollection";

export const solanaAgentkitPlguin: Plugin = {
    name: "solana",
    description: "Solana Plugin with solana agent kit for Eliza",
    actions: [createToken, postTweetToken, deployCollection],
    evaluators: [],
    providers: [],
};

export default solanaAgentkitPlguin;
