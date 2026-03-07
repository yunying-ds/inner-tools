import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

const client = new Anthropic();

const schema = {
  type: "object" as const,
  properties: {
    inputType: {
      type: "string",
      description: "One of: topic_event (a situation, goal, relationship, memory, or abstract thing the user wants to work on), feeling (an emotion or feeling state), body (a physical/body sensation)",
      enum: ["topic_event", "feeling", "body"],
    },
    label: {
      type: "string",
      description: "A short label (2-6 chars) summarizing the input, used as the topic reference throughout the session. e.g. '家族业力', '焦虑', '胸口发紧'",
    },
    aiReply: {
      type: "string",
      description: "A brief, warm Chinese response. For topic_event: acknowledge and ask what feeling comes up. For feeling/body: acknowledge and transition into the release process.",
    },
  },
  required: ["inputType", "label", "aiReply"],
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(ip).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { userInput } = await req.json();

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      tools: [{ name: "identify_input", description: "Identify the type of user input for a Sedona Method release session", input_schema: schema }],
      tool_choice: { type: "tool", name: "identify_input" },
      messages: [
        {
          role: "user",
          content: `You are a Sedona Method facilitator. The user has just entered something they want to work on releasing.

User input: "${userInput}"

Identify what type of input this is:
- topic_event: a situation, goal, relationship, event, memory, abstract concept, OR a bare body part noun with no sensation description (e.g. "原生家庭", "工作压力", "和朋友的矛盾", "家族业力", "下巴", "肩膀", "胃")
- feeling: an emotion or feeling state (e.g. "焦虑", "愤怒", "难过", "想逃避")
- body: a body part WITH a sensation/action/quality described (e.g. "胸口发紧", "头很沉", "肩膀紧绷", "下巴弹响", "胃在痉挛")

Priority rules:
- If the input is ONLY a body part noun with no sensation qualifier → topic_event
- If the input contains any emotional feeling → feeling (even if it also mentions a body part or topic)

For aiReply:
- topic_event: warm acknowledgment + "对于「{label}」，你现在有什么感受吗？"
- feeling: warm acknowledgment of the feeling, prepare to enter release
- body: warm acknowledgment + "关于这个「{label}」，你有什么感受吗？" (same pattern as topic_event)`,
        },
      ],
    });

    const toolUse = message.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") throw new Error("No tool use");

    return NextResponse.json(toolUse.input);
  } catch {
    // fallback: treat as feeling
    return NextResponse.json({
      inputType: "feeling",
      label: userInput.slice(0, 10),
      aiReply: "好的，让我们来释放这个感受。",
    });
  }
}
