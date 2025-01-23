## Getting Started with SendAI

Let's start by setting up a basic AI agent using SendAI's Solana Agent Kit that
can perform actions on the Solana blockchain and that we can chat with:

### Install dependencies

You will need to have [node](https://nodejs.org/en/download/) with version
`23.x.x` installed. Open an empty folder using vscode or cursor and run the
following command in the terminal:

```bash
pnpm install solana-agent-kit
```

### Configure environment

Create a `.env` file in the root of the project and add the following:

```env
OPENAI_API_KEY=your_openai_api_key
RPC_URL=https://api.devnet.solana.com
SOLANA_PRIVATE_KEY=your_private_key
```

Note that we encode the private key to base58 before we parse it into the solana
agent constructor in the script so you can just put the byte array [34,2,34...]
here in the env file.

You can create a key using the following command:

```bash
solana-keygen grind --starts-with ai:1
```

And copy the contents into your `.env` file for `SOLANA_PRIVATE_KEY`.

The OPENAI_API_KEY is the key for the OpenAI API and you can find it in the
[OpenAI platform](https://platform.openai.com/api-keys)

The RPC url we just leave at devnet for now.

### Create the agent script

Create a new file called `agent.ts` with the following content:

```typescript filename=agent.ts
import { SolanaAgentKit, createSolanaTools } from "solana-agent-kit";
import { HumanMessage } from "@langchain/core/messages";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import * as dotenv from "dotenv";
import bs58 from "bs58";
import * as readline from "readline";

dotenv.config();

async function initializeAgent() {
  const llm = new ChatOpenAI({
    modelName: "gpt-4-turbo-preview",
    temperature: 0.7,
  });

  // Convert array string to actual array, then to Uint8Array, then to base58
  const privateKeyArray = JSON.parse(process.env.SOLANA_PRIVATE_KEY!);
  const privateKeyUint8 = new Uint8Array(privateKeyArray);
  const privateKeyBase58 = bs58.encode(privateKeyUint8);

  const solanaKit = new SolanaAgentKit(privateKeyBase58, process.env.RPC_URL!, {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
  });

  const tools = createSolanaTools(solanaKit);
  const memory = new MemorySaver();

  return createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
  });
}

async function runInteractiveChat() {
  const agent = await initializeAgent();
  const config = { configurable: { thread_id: "Solana Agent Kit!" } };
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // Clear console and start chat with a small delay
  setTimeout(() => {
    console.clear(); // Clear any initialization messages
    console.log("Chat with Solana Agent (type 'exit' to quit)");
    console.log("--------------------------------------------");
    askQuestion();
  }, 100);

  const askQuestion = () => {
    rl.question("You: ", async input => {
      if (input.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      const stream = await agent.stream(
        {
          messages: [new HumanMessage(input)],
        },
        config,
      );

      process.stdout.write("Agent: ");
      for await (const chunk of stream) {
        if ("agent" in chunk) {
          process.stdout.write(chunk.agent.messages[0].content);
        } else if ("tools" in chunk) {
          process.stdout.write(chunk.tools.messages[0].content);
        }
      }
      console.log("\n--------------------------------------------");

      askQuestion(); // Continue the conversation
    });
  };
}

runInteractiveChat().catch(console.error);
```

### Run the agent

You can run this script using the following command:

```bash
npx tsx agent.ts
```

This will start a simple chat with the agent.

### Test basic functionality

You can now ask it to show you your solana balance and ask it to request some
devnet sol:

```bash
Please show me my wallet address and request some devnet sol
```

If the devnet faucet is empty you can use the
[web faucet](https://faucet.solana.com) instead and paste in your solana
address.

### Create an NFT collection

Next ask the agent:

```bash
Please create me a NFT collection called trains with symbol TRN using this uri: https://scarlet-fancy-minnow-617.mypinata.cloud/ipfs/bafkreif43sp62yuy3sznrvqesk23tfnhpdck4npqowdwrhrzhsrgf5ao2e
```

### Mint an NFT

After the collection is created, mint an NFT:

```bash
Please mint me an NFT into that collection using the name: Train1 and using this URI: https://scarlet-fancy-minnow-617.mypinata.cloud/ipfs/bafkreif43sp62yuy3sznrvqesk23tfnhpdck4npqowdwrhrzhsrgf5ao2e
```

This will mint you an NFT with the name Train1 and an image of a train.

You can also use any different metadata for your NFT which you can upload using
[pinata](https://app.pinata.cloud/) or any other storage provider. You should
end up with something like this
[devnet train nft](https://explorer.solana.com/address/6dTVGn2M8LdAB6vrxzt7X8fm8HiP1QxN9j8jeh1dbyv8?cluster=devnet)

You can now for example import the private key into your browser extension
wallet to see the NFT. Or you can ask the agent to show you all your NFTs. The
default action uses the Helius Asset api to request assets so for that you would
need to add a [Helius API key](https://www.helius.dev/) to your `.env` file and
pass it into the agent or you can now start writing your own actions following
the
[Contribution guide](https://github.com/sendaifun/solana-agent-kit/blob/main/CONTRIBUTING.md)

Not all actions are working 100% yet but you can see the progress in the
[Solana agent kit repo](https://github.com/sendaifun/solana-agent-kit) and also
contribute your own actions to be used by everyone.

## Building with Eliza Framework

The [ElizaOS](https://github.com/elizaOS/eliza) (formerly known as Ai16z) is an
AI framework. That means it combines multiple applications into one and
organizes their interactions. It combines:

1. Different LLMs to understand the user
2. Blockchain agents with different actions (like minting an NFT for example)
3. Datalayers to store the characters state between actions using for example
   Redis, PostgreSQL DB or local storage
4. Different clients like X, telegram, discord. etc.

Its takes all these things and puts them together in a way that you can create a
"Character" that can interact with users or autonomously. These Characters are
defined in a JSON file, which defines which actions it can perform, which LLM it
should use and different prompts that define the behaviour of the character.

### Building a Twitter (X) bot that can mint NFTs on request

What we will build now is a helpful solana developer assistant that can help
developers on the platform X to get started with solana and it will also be able
to mint NFTs to the users on demand.

### Clone the repository

First clone the Eliza repository:

```bash
git clone https://github.com/elizaOS/eliza.git
```

### Set up the environment

Make sure you have `node` version `23.x.x` installed using
[nvm](https://github.com/nvm-sh/nvm):

```bash
node --version
nvm use 23
```

Then install the dependencies:

```bash
pnpm install --no-frozen-lockfile
pnpm build
```

### Configure environment variables

Create your environment file:

```bash
cp .env.example .env
```

What we are interested in for this guide is:

```env
TWITTER_USERNAME=               # Account username
TWITTER_PASSWORD=               # Account password
TWITTER_EMAIL=
OPENAI_API_KEY=                 # Get this from: https://platform.openai.com/api-keys
SOLANA_RPC_URL=https://api.devnet.solana.com # Lets work on devnet for now
SOLANA_PRIVATE_KEY=             # Get this from: https://solana.com/wallet
SOLANA_PUBLIC_KEY=
SOLANA_CLUSTER=devnet # Default: devnet. Solana Cluster: 'devnet' | 'testnet' | 'mainnet-beta'
SOLANA_ADMIN_PRIVATE_KEY=       # This wallet is used to verify NFTs (you can use the same as the SOLANA_PRIVATE_KEY for now)
SOLANA_ADMIN_PUBLIC_KEY=        # This wallet is used to verify NFTs (you can use the same as the SOLANA_PUBLIC_KEY for now)
```

Make sure you have some
[devnet sol](https://solana.com/de/developers/guides/getstarted/solana-token-airdrop-and-faucets)
in your wallet before you start the agent.

### Encode private key (if needed)

If you have your private key in hex format you can base58 encode your private
key using the following js snippet:

```ts filename=encode58.ts
const bs58 = require('bs58');
console.log(bs58.encode(new Uint8Array([213,29,143,...])));
```

And run it using

```bash
npx tsx encode58.ts
```

### Create character configuration

To create a new character I would recommend using the composer feature in Cursor
and tell it what kind of character you want to create. Give it one of the other
characters as input and describe what king of character you want to create.

```json filename=character.json
{
    "name": "Sol",
    "clients": ["twitter"],
    "modelProvider": "openai",
    "settings": {
        "voice": {
            "model": "en_US-neural"
        },
        ...
```

The important part here are the clients and the modelProvider. In our case we
want to use twitter as a client and openai as the model provider because this is
what we also set our secrets for in the `.env` file.

### Run the agent

Now that the configuration is done we can run our character:

```bash
pnpm start --character="characters/sol.character.json"
```

This will start the agent and you can now interact with it on twitter. The
character will automatically start posting tweets every few hours and when we
interact with him it will be able to perform solana actions like minting NFTs
for example.

Here you can see the
[character in action](https://x.com/solanadevhelper/status/1882222232656847143).

You can also interact with the character locally using the following command:

```bash
pnpm start:client
```

For more information follow the
[official eliza documentation](https://elizaos.github.io/eliza/docs/quickstart/)


Disclaimer: The Solana integration and actions are not perfect yet but they are
in constant development and are moving fast. There will be a direct integration
of the SendAI agent kit into Eliza soon.