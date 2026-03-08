import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { buildEmotionTableText } from "@/lib/release/emotions";
import { checkRateLimit } from "@/lib/rate-limit";

const client = new Anthropic();
const EMOTION_TABLE = buildEmotionTableText();

const emotionSchema = {
  type: "object" as const,
  properties: {
    wordsEn: {
      type: "array",
      description: "1-3 English keywords selected from the official table",
      items: { type: "string" },
    },
    wordsCn: {
      type: "array",
      description: "Context-aware Chinese translations of the English keywords, informed by user's specific situation (not mechanical dictionary translation)",
      items: { type: "string" },
    },
    level: { type: "string", description: "Chinese level name: 冷漠/悲伤/恐惧/欲望/愤怒/骄傲/勇气/接纳/平静" },
    levelEn: { type: "string", description: "English level name: Apathy/Grief/Fear/Lust/Anger/Pride/Courageousness/Acceptance/Peace" },
    levelIndex: { type: "number", description: "Level index 1-9" },
    aiReply: { type: "string", description: "Warm, brief acknowledgment in the language matching the lang parameter" },
    allEmotions: {
      type: "array",
      description: "Only when multiple distinct emotion levels detected",
      items: {
        type: "object",
        properties: {
          wordsEn: { type: "array", items: { type: "string" } },
          wordsCn: { type: "array", items: { type: "string" } },
          level: { type: "string" },
          levelEn: { type: "string" },
          levelIndex: { type: "number" },
        },
        required: ["wordsEn", "wordsCn", "level", "levelEn", "levelIndex"],
      },
    },
  },
  required: ["wordsEn", "wordsCn", "level", "levelEn", "levelIndex", "aiReply"],
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(ip).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { userInput, lang } = await req.json();
  const isEn = lang === "en";

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      tools: [
        {
          name: "identify_emotion",
          description: "Identify the emotion level(s) from the Sedona Method chart based on user input",
          input_schema: emotionSchema,
        },
      ],
      tool_choice: { type: "tool", name: "identify_emotion" },
      messages: [
        {
          role: "user",
          content: `You are a Sedona Method facilitator. Identify the emotion(s) from the official AGFLAP-CAP chart.
Response language for aiReply: ${isEn ? "English" : "Chinese"}

Official emotion chart:
${EMOTION_TABLE}

User's description: "${userInput}"

Instructions:
1. Select English keywords from the chart — one keyword per distinct feeling the user mentioned (up to 3). Do NOT merge or collapse multiple feelings into one keyword.
2. Translate them to Chinese based on the USER'S SPECIFIC CONTEXT — not a mechanical dictionary translation.
3. Identify the primary emotion level
4. If multiple distinct levels are present (e.g., both Fear and Anger), list all in allEmotions
5. aiReply: warm, brief acknowledgment in ${isEn ? "English" : "Chinese"} (1 sentence).
6. Keep wordsCn natural and resonant — the user should recognize themselves in the words`,
        },
      ],
    });

    const toolUse = message.content.find((c) => c.type === "tool_use");
    if (!toolUse || toolUse.type !== "tool_use") {
      return NextResponse.json({
        wordsEn: [],
        wordsCn: [],
        words: [],
        level: "恐惧",
        levelEn: "Fear",
        levelIndex: 3,
        aiReply: isEn ? "I hear you. Let's continue." : "我听到了你的描述，让我们继续。",
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = toolUse.input as any;

    // 向下兼容：保留 `words` 字段（session-client.tsx 用它展示）
    return NextResponse.json({
      ...result,
      words: result.wordsCn ?? result.wordsEn ?? [],
      // allEmotions 同样补充 words 字段
      allEmotions: result.allEmotions?.map((e: { wordsCn?: string[]; wordsEn?: string[]; words?: string[] }) => ({
        ...e,
        words: e.wordsCn ?? e.wordsEn ?? [],
      })),
    });
  } catch (e) {
    console.error("[identify-emotion]", e);
    return NextResponse.json({
      wordsEn: [],
      wordsCn: [],
      words: [],
      level: "恐惧",
      levelEn: "Fear",
      levelIndex: 3,
      aiReply: isEn ? "I hear you. Let's continue." : "我听到了你的描述。让我们继续这个过程。",
      _aiUnavailable: true,
    });
  }
}
