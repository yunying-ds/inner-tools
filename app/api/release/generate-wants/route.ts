import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

const client = new Anthropic();

const FALLBACK_WANTS = [
  { label: "想要被认可/被爱", description: "你想要被理解、被看见、被认可吗？" },
  { label: "想要掌控", description: "你想要掌控局面、让一切按你的计划进行吗？" },
  { label: "想要安全/生存", description: "你担心失去某些重要的东西、害怕未来没有保障吗？" },
];

export async function POST(req: NextRequest) {
  const { emotionLevel, emotionWords, userInput } = await req.json();

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: `你是圣多纳释放法引导师。根据用户的情绪情况，生成"三大想要"的具体选项。

用户情况：
- 用户描述："${userInput}"
- 识别情绪：${(emotionWords ?? []).join("、")}
- 情绪层级：${emotionLevel ?? "未知"}

三大想要类型（必须用这三个标签）：
1. 想要被认可/被爱
2. 想要掌控
3. 想要安全/生存

请根据用户的具体情境定制描述，不要用通用模板，要贴合用户实际情况。

返回 JSON（不要包含其他文字）：
{
  "wants": [
    {"label": "想要被认可/被爱", "description": "针对用户具体情境的描述，以你想要...开头，以吗？结尾"},
    {"label": "想要掌控", "description": "针对用户具体情境的描述，以你想要...开头，以吗？结尾"},
    {"label": "想要安全/生存", "description": "针对用户具体情境的描述，以你担心...或你害怕...开头，以吗？结尾"}
  ]
}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return NextResponse.json({ wants: FALLBACK_WANTS });
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error("[generate-wants]", e);
    return NextResponse.json({ wants: FALLBACK_WANTS });
  }
}
