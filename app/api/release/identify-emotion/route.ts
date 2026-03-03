import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";
import { buildEmotionTableText } from "@/lib/release/emotions";

const client = new Anthropic();
const EMOTION_TABLE = buildEmotionTableText();

export async function POST(req: NextRequest) {
  const { userInput } = await req.json();

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      messages: [
        {
          role: "user",
          content: `你是圣多纳释放法的引导师。请根据用户描述，从官方情绪表中识别情绪。

官方情绪表：
${EMOTION_TABLE}

用户描述："${userInput}"

请返回 JSON 格式（不要包含其他文字）：
{
  "words": ["属于主要 level 的词，最多2个"],
  "level": "主要情绪层级",
  "levelIndex": 对应序号,
  "aiReply": "温和的反馈",
  "allEmotions": [可选，见下方说明]
}

规则：
- words：必填，1-2个。从该 level 的关键词表中选取最贴近用户描述的词；若无完全匹配，选近义词或用简短自然语言描述（3字以内），但语义必须属于该 level
- level：从冷漠/悲伤/恐惧/欲望/愤怒/骄傲/勇气/接纳/平静中选最主要的那个
- levelIndex：冷漠=1，悲伤=2，恐惧=3，欲望=4，愤怒=5，骄傲=6，勇气=7，接纳=8，平静=9
- aiReply：若情绪单一，用"听起来你现在感到……"；若情绪混合，用"我感受到……和……交织在一起"
- allEmotions（仅在检测到来自不同层级的多种情绪时填写）：列出所有检测到的情绪，每项格式为 {"words": [...], "level": "...", "levelIndex": 数字}，每项的 words 只填属于该项 level 的词

示例（单一情绪）：
用户说"我感到很焦虑，不知道该怎么办"时，应返回：
{
  "words": ["焦虑", "不确定"],
  "level": "恐惧",
  "levelIndex": 3,
  "aiReply": "听起来你现在感到焦虑和不确定。"
}

示例（混合情绪）：
用户说"既害怕又很期待"时，应返回：
{
  "words": ["担心"],
  "level": "恐惧",
  "levelIndex": 3,
  "aiReply": "我感受到恐惧和期待交织在一起",
  "allEmotions": [
    {"words": ["担心"], "level": "恐惧", "levelIndex": 3},
    {"words": ["期待"], "level": "欲望", "levelIndex": 4}
  ]
}`,
        },
      ],
    });

    const text = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ words: [], level: "恐惧", levelIndex: 3, aiReply: `听起来你现在感到${userInput.slice(0, 20)}。` });
    }
    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (e) {
    console.error("[identify-emotion]", e);
    return NextResponse.json({
      words: [],
      level: "恐惧",
      levelIndex: 3,
      aiReply: "我听到了你的描述。让我们继续这个过程。",
      _aiUnavailable: true,
    });
  }
}
