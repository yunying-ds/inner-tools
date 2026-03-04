import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";

const client = new Anthropic();

type CompletionResult = "new_emotion" | "feeling_better" | "residual_remains" | "unclear";

const FALLBACK = { result: "unclear" as CompletionResult, newEmotionHint: null, message: "感谢你的分享，这轮释放完成了。" };

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  if (!checkRateLimit(ip).ok) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const { userInput, previousEmotion } = await req.json();

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `你是圣多纳释放法引导师。用户完成一轮释放后描述了当前感受，请判断状态。

之前处理的情绪：${previousEmotion}
用户现在说："${userInput}"

判断规则：
- new_emotion：用户明确提到了新的情绪词（如"现在又感到愤怒"）
- feeling_better：用户表达轻松/平静/好转（如"轻松了"、"好多了"、"没那么紧张了"）
- residual_remains：用户表达还有残留（如"还有点"、"还是有些"、"依然"）
- unclear：无法判断

返回 JSON（不要包含其他文字）：
{
  "result": "new_emotion 或 feeling_better 或 residual_remains 或 unclear",
  "newEmotionHint": "如果是new_emotion，提取新情绪词，否则为null",
  "message": "给用户的简短温和回复（10-20字）"
}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json(FALLBACK);
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error("[analyze-completion]", e);
    return NextResponse.json(FALLBACK);
  }
}
