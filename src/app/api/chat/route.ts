import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { getSessionUser } from "@/lib/api/session";

const CHAT_SYSTEM = `You are a friendly AI estimator for Tradeflo AI, a quoting tool for trades contractors in Atlantic Canada.

Your job: have a short natural conversation to gather job details for an accurate quote.

RULES:
- After the contractor describes the job, assess if you have enough to quote accurately.
- If yes: respond with READY_TO_QUOTE followed by a JSON object.
- If no: ask 1-3 targeted questions in ONE message. Never ask more than 2 rounds.
- After 2 rounds always output READY_TO_QUOTE.
- Keep it short and conversational. Busy contractor on their phone.
- Good questions: sq ft, property type, materials, access, timeline.
- Never ask for customer name or contact — collected separately.

When ready:
READY_TO_QUOTE
{"jobType":"...","propertyType":"...","sqft":"...","scope":"...","materials":"...","location":"Atlantic Canada","timeline":"..."}`;

export async function POST(req: Request) {
  const { user } = await getSessionUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: { messages: UIMessage[] };
  try {
    body = (await req.json()) as { messages: UIMessage[] };
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!body.messages?.length) {
    return new Response(JSON.stringify({ error: "messages required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const modelMessages = await convertToModelMessages(body.messages);

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: CHAT_SYSTEM,
    messages: modelMessages,
    maxOutputTokens: 800,
  });

  return result.toUIMessageStreamResponse();
}
