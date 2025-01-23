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
    openAIApiKey: process.env.OPENAI_API_KEY,
    configuration: {
      baseURL: "https://api.openai.com/v1",
    }
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
    rl.question("You: ", async (input) => {
      if (input.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      const stream = await agent.stream(
        {
          messages: [new HumanMessage(input)],
        },
        config
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
