import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { fromNodeProviderChain } from "@aws-sdk/credential-providers";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse";
import { experimental_createMCPClient, streamText } from "ai";

const bedrock = createAmazonBedrock({
  credentialProvider: fromNodeProviderChain(),
});

(async () => {
  const url = `https://mcp-server.fuderrpham.io.vn/sse`;
  const transport = new SSEClientTransport(new URL(url));
  const client = await experimental_createMCPClient({ transport });
  console.warn("Created MCP client", { url });

  try {
    const tools = await client.tools();
    console.warn({ tools: Object.keys(tools) });

    const startedAt = Date.now();
    const { fullStream } = streamText({
      model: bedrock("amazon.nova-pro-v1:0"),
      tools,
      maxSteps: 3,
      messages: [
        {
          role: "user",
          content: "What is the documentation about AWS SageMaker Studio?",
        },
      ],
    });

    for await (const part of fullStream) {
      switch (part.type) {
        case "tool-call":
          const { toolName, args } = part;
          console.warn("Tool call:", toolName, JSON.stringify(args, null, 2));
          break;
        case "tool-result":
          const { result } = part;
          console.warn(JSON.stringify(result, null, 2));
          break;
        case "text-delta":
          const { textDelta } = part;
          process.stdout.write(textDelta);
          break;
        case "step-finish":
        case "step-start":
        case "finish":
          process.stderr.write("\n");
          break;
        default:
          console.warn("Unknown part:", { part });
          break;
      }
    }

    const elapsedInMs = Date.now() - startedAt;
    console.log({ elapsedInMs });
  } finally {
    await transport.close();
  }
})();
