import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

const client = new Anthropic();

const analysisSchema = {
  type: "object" as const,
  properties: {
    type: {
      type: "string",
      description: "'release_signal' | 'new_emotion' | 'mixed'",
    },
    feedback: {
      type: "string",
      description: "Warm Chinese acknowledgment of what the user described (1-2 sentences)",
    },
    hasNewEmotion: {
      type: "boolean",
      description: "True if a new emotion that needs releasing has emerged",
    },
  },
  required: ["type", "feedback", "hasNewEmotion"],
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(ip).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { userInput, currentEmotion } = await req.json();

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      tools: [
        {
          name: "analyze_step9",
          description: "Analyze the user's post-release reflection",
          input_schema: analysisSchema,
        },
      ],
      tool_choice: { type: "tool", name: "analyze_step9" },
      messages: [
        {
          role: "user",
          content: `You are a Sedona Method facilitator. The user just released "${currentEmotion}" and wrote:

"${userInput}"

Determine:

1. RELEASE SIGNALS — physical/emotional signs the body is releasing: yawning (打哈欠), sighing (叹气), dry heaving (干呕), tears, tingling, warmth, feeling lighter, deep breath, spontaneous laughter, muscle relaxation, spaciousness. These are POSITIVE — warmly validate them as signs the release is working.

2. NEW EMOTION — a new distinct emotion or situation they want to process.

3. MIXED — both present.

Rules:
- Dry heaving, nausea, yawning = release signals, NOT new emotions to process
- If it's a release signal: acknowledge it warmly ("干呕是身体在排出紧绷的能量，这很好。")
- Keep feedback brief, warm, in Chinese
- hasNewEmotion: true only if they explicitly describe a new emotion worth a new release cycle`,
        },
      ],
    });

    const toolUse = message.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({
        type: "release_signal",
        feedback: "感谢你的记录，这次释放完成了。",
        hasNewEmotion: false,
      });
    }

    return NextResponse.json(toolUse.input);
  } catch (e) {
    console.error("[analyze-step9]", e);
    return NextResponse.json({
      type: "release_signal",
      feedback: "感谢你的记录，这次释放完成了。",
      hasNewEmotion: false,
    });
  }
}
