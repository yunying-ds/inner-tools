import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

const client = new Anthropic();

const FALLBACK_WANTS_ZH = [
  { label: "想要控制", description: "你想要控制局面、让一切按你的计划进行吗？" },
  { label: "想要被认同/被爱", description: "你想要被理解、被看见、被认同、被爱吗？" },
  { label: "想要安全/生存", description: "你担心失去某些重要的东西、害怕未来没有保障吗？" },
];
const FALLBACK_WANTS_EN = [
  { label: "Wanting Control", description: "Do you want to control the situation, have things go your way?" },
  { label: "Wanting Approval / Love", description: "Do you want to be understood, seen, accepted, loved?" },
  { label: "Wanting Security / Survival", description: "Are you afraid of losing something important, or worried about the future?" },
];

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(ip).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { emotionLevel, emotionWords, userInput, lang } = await req.json();
  const isEn = lang === "en";
  const FALLBACK_WANTS = isEn ? FALLBACK_WANTS_EN : FALLBACK_WANTS_ZH;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      tools: [
        {
          name: "generate_wants",
          description: "Generate the three core wants as specific options",
          input_schema: {
            type: "object" as const,
            properties: {
              wants: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    description: { type: "string" },
                  },
                  required: ["label", "description"],
                },
              },
            },
            required: ["wants"],
          },
        },
      ],
      tool_choice: { type: "tool", name: "generate_wants" },
      messages: [
        {
          role: "user",
          content: isEn
            ? `You are a Sedona Method facilitator. Based on the user's emotion, generate specific options for the "Three Core Wants". Respond entirely in English.

User situation:
- User description: "${userInput}"
- Identified emotions: ${(emotionWords ?? []).join(", ")}
- Emotion level: ${emotionLevel ?? "unknown"}

The three want types (use exactly these labels):
1. Wanting Control
2. Wanting Approval / Love
3. Wanting Security / Survival

Customize each description to fit the user's specific context. Do not use generic templates.
- Wanting Approval / Love: start with "Do you want..." end with "?"
- Wanting Control: start with "Do you want..." end with "?"
- Wanting Security / Survival: start with "Are you afraid of..." or "Do you worry about..." end with "?"`
            : `你是圣多纳释放法引导师。根据用户的情绪情况，生成"三大想要"的具体选项。

用户情况：
- 用户描述：「${userInput}」
- 识别情绪：${(emotionWords ?? []).join("、")}
- 情绪层级：${emotionLevel ?? "未知"}

三大想要类型（必须用这三个标签）：
1. 想要控制
2. 想要被认同/被爱
3. 想要安全/生存

请根据用户的具体情境定制描述，不要用通用模板，要贴合用户实际情况。
- 想要被认同/被爱：以"你想要..."开头，以"吗？"结尾
- 想要控制：以"你想要..."开头，以"吗？"结尾
- 想要安全/生存：以"你担心..."或"你害怕..."开头，以"吗？"结尾`,
        },
      ],
    });

    const toolUse = message.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({ wants: FALLBACK_WANTS });
    }
    return NextResponse.json(toolUse.input);
  } catch (e) {
    console.error("[generate-wants]", e);
    return NextResponse.json({ wants: FALLBACK_WANTS });
  }
}
