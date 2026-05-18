import { NodeSDK } from "@opentelemetry/sdk-node";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PostHogSpanProcessor } from "@posthog/ai/otel";
import { OpenAIInstrumentation } from "@opentelemetry/instrumentation-openai";
import { GenAIInstrumentation } from "@traceloop/instrumentation-google-generativeai";

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig();
  const posthogConfig = config.public.posthog as {
    publicKey: string;
    host: string;
  };

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      "service.name": "lumiar-server",
    }),
    spanProcessors: [
      new PostHogSpanProcessor({
        apiKey: posthogConfig.publicKey,
        host: posthogConfig.host,
      }),
    ],
    instrumentations: [
      new OpenAIInstrumentation(),
      new GenAIInstrumentation(),
    ],
  });

  sdk.start();
});
