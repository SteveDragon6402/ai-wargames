import Anthropic from "@anthropic-ai/sdk";
import { config as loadDotenv } from "dotenv";
import { resolve } from "node:path";

const MODELS = ["claude-sonnet-5", "claude-haiku-4-5"];
const NO_THINKING = { thinking: { type: "disabled" as const } };

function refreshEnv(): void {
  try {
    loadDotenv({ path: resolve(process.cwd(), "../../.env"), override: true });
    loadDotenv({ path: resolve(process.cwd(), ".env"), override: true });
  } catch {
    // ignore if .env is not present
  }
}

interface OpenCompatibleProvider {
  url: string;
  apiKey: string;
  models: string[];
}

/**
 * Resolves an OpenAI-compatible open-weight LLM fallback provider when configured:
 * - OPENROUTER_API_KEY -> Mistral Small 3.1 24B (French-native lab) / Qwen 2.5 72B / Llama 3.3 70B
 * - MISTRAL_API_KEY    -> mistral-small-latest
 * - GROQ_API_KEY       -> llama-3.3-70b-versatile
 * - OPEN_LLM_BASE_URL / OLLAMA_MODEL -> Local Ollama / vLLM server (e.g. http://127.0.0.1:11434/v1/chat/completions)
 */
function resolveOpenFallbackProvider(): OpenCompatibleProvider | null {
  refreshEnv();
  const customModel = process.env.OPEN_LLM_MODEL?.trim();
  const customBase = process.env.OPEN_LLM_BASE_URL?.trim();
  if (customBase) {
    const endpoint = customBase.endsWith("/chat/completions")
      ? customBase
      : `${customBase.replace(/\/+$/, "")}/chat/completions`;
    return {
      url: endpoint,
      apiKey: process.env.OPEN_LLM_API_KEY?.trim() || "local",
      models: customModel ? [customModel] : ["mistral-small", "qwen2.5:14b"],
    };
  }
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    return {
      url: "https://openrouter.ai/api/v1/chat/completions",
      apiKey: openRouterKey,
      models: customModel
        ? [customModel]
        : [
            "mistralai/mistral-small-3.1-24b-instruct",
            "qwen/qwen-2.5-72b-instruct",
            "meta-llama/llama-3.3-70b-instruct",
          ],
    };
  }
  const mistralKey = process.env.MISTRAL_API_KEY?.trim();
  if (mistralKey) {
    return {
      url: "https://api.mistral.ai/v1/chat/completions",
      apiKey: mistralKey,
      models: customModel ? [customModel] : ["mistral-small-latest", "mistral-large-latest"],
    };
  }
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    return {
      url: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: groqKey,
      models: customModel ? [customModel] : ["llama-3.3-70b-versatile"],
    };
  }
  const ollamaModel = process.env.OLLAMA_MODEL?.trim();
  if (ollamaModel) {
    return {
      url: "http://127.0.0.1:11434/v1/chat/completions",
      apiKey: "ollama",
      models: [ollamaModel],
    };
  }
  return null;
}

export function anthropicClient(): Anthropic | { error: string } {
  refreshEnv();
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    const fallback = resolveOpenFallbackProvider();
    if (fallback) {
      return new Anthropic({ apiKey: "fallback-only" });
    }
    return {
      error:
        "No LLM API key configured. Set ANTHROPIC_API_KEY, or configure an open-model fallback (OPENROUTER_API_KEY, MISTRAL_API_KEY, GROQ_API_KEY, OPEN_LLM_BASE_URL, or OLLAMA_MODEL).",
    };
  }
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic({
    apiKey,
    ...(workspace ? { defaultHeaders: { "anthropic-workspace-id": workspace } } : {}),
  });
}

/** Mistral's `/v1/chat/completions` requires `tool_call_id` to be 9 alphanumeric chars (`^[a-zA-Z0-9]{9}$`). */
function normalizeToolCallId(rawId: string, index = 0): string {
  const alnum = rawId.replace(/[^a-zA-Z0-9]/g, "");
  if (alnum.length >= 9) return alnum.slice(-9);
  return `${alnum}${String(index)}${"a1b2c3d4e"}`.slice(0, 9);
}

function toOpenAIMessages(
  system: Anthropic.Messages.MessageCreateParamsNonStreaming["system"],
  messages: Anthropic.Messages.MessageParam[],
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  if (typeof system === "string" && system.trim()) {
    out.push({ role: "system", content: system });
  } else if (Array.isArray(system)) {
    const sysText = system
      .filter((b): b is Anthropic.Messages.TextBlockParam => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    if (sysText.trim()) out.push({ role: "system", content: sysText });
  }

  for (const msg of messages) {
    if (typeof msg.content === "string") {
      out.push({ role: msg.role, content: msg.content });
      continue;
    }
    if (!Array.isArray(msg.content)) continue;

    if (msg.role === "assistant") {
      const texts: string[] = [];
      const toolCalls: Record<string, unknown>[] = [];
      for (let idx = 0; idx < msg.content.length; idx++) {
        const block = msg.content[idx];
        if (block.type === "text") {
          texts.push(block.text);
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: normalizeToolCallId(block.id, idx),
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input ?? {}),
            },
          });
        }
      }
      out.push({
        role: "assistant",
        content: texts.join("\n") || "",
        ...(toolCalls.length ? { tool_calls: toolCalls } : {}),
      });
    } else {
      const texts: string[] = [];
      for (let idx = 0; idx < msg.content.length; idx++) {
        const block = msg.content[idx];
        if (block.type === "tool_result") {
          const contentStr =
            typeof block.content === "string" ? block.content : JSON.stringify(block.content ?? "");
          out.push({
            role: "tool",
            tool_call_id: normalizeToolCallId(block.tool_use_id, idx),
            content: contentStr,
          });
        } else if (block.type === "text") {
          texts.push(block.text);
        }
      }
      if (texts.length) {
        out.push({ role: "user", content: texts.join("\n") });
      }
    }
  }
  return out;
}

async function createWithOpenFallback(
  provider: OpenCompatibleProvider,
  body: Omit<Anthropic.Messages.MessageCreateParamsNonStreaming, "model">,
): Promise<Anthropic.Messages.Message | { error: string }> {
  const oaMessages = toOpenAIMessages(body.system, body.messages);
  const oaTools = Array.isArray(body.tools)
    ? body.tools
        .filter((t): t is Anthropic.Tool => "input_schema" in t)
        .map((t) => ({
          type: "function",
          function: {
            name: t.name,
            description: t.description ?? "",
            parameters: t.input_schema,
          },
        }))
    : undefined;

  let lastError = "Open fallback model did not respond.";
  for (const model of provider.models) {
    try {
      const res = await fetch(provider.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: body.max_tokens,
          messages: oaMessages,
          ...(oaTools && oaTools.length ? { tools: oaTools } : {}),
        }),
      });
      if (!res.ok) {
        lastError = `Open LLM (${model}) HTTP ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`;
        continue;
      }
      const data = (await res.json()) as {
        id?: string;
        model?: string;
        choices?: {
          message?: {
            content?: string | null;
            tool_calls?: { id?: string; function?: { name?: string; arguments?: string } }[];
          };
        }[];
      };
      const choice = data.choices?.[0]?.message;
      if (!choice) {
        lastError = `Open LLM (${model}) returned no message choice.`;
        continue;
      }
      const content: Anthropic.Messages.ContentBlock[] = [];
      if (typeof choice.content === "string" && choice.content.trim()) {
        content.push({ type: "text", text: choice.content, citations: null });
      }
      if (Array.isArray(choice.tool_calls)) {
        for (let i = 0; i < choice.tool_calls.length; i++) {
          const tc = choice.tool_calls[i];
          const name = tc?.function?.name ?? "";
          if (!name) continue;
          let parsedInput: Record<string, unknown> = {};
          try {
            parsedInput = JSON.parse(tc?.function?.arguments || "{}") as Record<string, unknown>;
          } catch {
            parsedInput = {};
          }
          content.push({
            type: "tool_use",
            id: normalizeToolCallId(tc?.id || `call${i}`, i),
            name,
            input: parsedInput,
          });
        }
      }
      return {
        id: data.id || "msg_open_fallback",
        type: "message",
        role: "assistant",
        model: data.model || model,
        content,
        stop_reason: content.some((b) => b.type === "tool_use") ? "tool_use" : "end_turn",
        stop_sequence: null,
        usage: {
          input_tokens: 0,
          output_tokens: 0,
          cache_creation_input_tokens: null,
          cache_read_input_tokens: null,
          server_tool_use: null,
          service_tier: null,
        },
      } as Anthropic.Messages.Message;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  return { error: lastError };
}

async function createWith(
  client: Anthropic,
  models: string[],
  body: Omit<Anthropic.Messages.MessageCreateParamsNonStreaming, "model">,
): Promise<Anthropic.Messages.Message | { error: string }> {
  let last = "No model responded.";
  const preferOpen = Boolean(process.env.PREFER_OPEN_LLM?.trim() || process.env.PREFER_MISTRAL?.trim());
  const openProvider = resolveOpenFallbackProvider();
  if (preferOpen && openProvider) {
    const res = await createWithOpenFallback(openProvider, body);
    if (!("error" in res)) return res;
    last = res.error;
  }
  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
  if (hasAnthropicKey) {
    for (const model of models) {
      try {
        const response = await client.messages.create({
          ...body,
          model,
          ...NO_THINKING,
        } as Anthropic.Messages.MessageCreateParamsNonStreaming);
        return response;
      } catch (err) {
        last = err instanceof Error ? err.message : String(err);
        if (/authentication|api.?key|credit|balance|401|403/i.test(last)) break;
      }
    }
  }
  if (openProvider) {
    return createWithOpenFallback(openProvider, body);
  }
  return { error: last };
}

export async function createMessage(
  client: Anthropic,
  body: Omit<Anthropic.Messages.MessageCreateParamsNonStreaming, "model">,
): Promise<Anthropic.Messages.Message | { error: string }> {
  return createWith(client, MODELS, body);
}

export function textOf(response: Anthropic.Messages.Message): string {
  return response.content
    .filter((block): block is Anthropic.Messages.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

export function toolUses(response: Anthropic.Messages.Message): Anthropic.Messages.ToolUseBlock[] {
  return response.content.filter((block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use");
}
