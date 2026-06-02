import { condensePrompt, polishPrompt } from "../utils/polishPrompt";

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  await requireUser(event);

  const { prompt, mode } = await readBody(event);

  if (typeof prompt !== "string" || !prompt.trim()) {
    throw createError({ statusCode: 400, message: "No prompt provided" });
  }
  if (prompt.length > 20_000) {
    throw createError({ statusCode: 400, message: "Prompt is too long" });
  }

  const apiKey = config.openrouterApiKey as string;
  const polished =
    mode === "condense"
      ? await condensePrompt(prompt, apiKey)
      : await polishPrompt(prompt, apiKey);

  return { polished };
});
