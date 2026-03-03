import type { EmotionLevel, EmotionLevelIndex } from "@/types/release";

export interface EmotionLevelInfo {
  name: EmotionLevel;
  index: EmotionLevelIndex;
  core: string;
  keywords: string[];
  isRestrictive: boolean;
}

export const EMOTION_LEVELS: EmotionLevelInfo[] = [
  {
    name: "冷漠",
    index: 1,
    core: "无力、放弃",
    isRestrictive: true,
    keywords: [
      "无聊", "无法取胜", "无助", "绝望", "沮丧", "麻木", "无力", "没希望",
      "失败", "放弃", "筋疲力尽", "消极", "不在乎", "无用", "无价值",
    ],
  },
  {
    name: "悲伤",
    index: 2,
    core: "失去、受伤",
    isRestrictive: true,
    keywords: [
      "被遗弃", "被虐待", "被指责", "羞愧", "被背叛", "忧郁", "被欺骗",
      "失望", "内疚", "心碎", "受伤", "被忽视", "不公平", "孤独", "失落",
      "被误解", "哀悼", "被忽略", "可怜", "后悔", "被拒绝", "伤心", "折磨",
      "不快乐", "不被爱", "不被需要", "脆弱",
    ],
  },
  {
    name: "恐惧",
    index: 3,
    core: "不安全、威胁",
    isRestrictive: true,
    keywords: [
      "焦虑", "担忧", "害怕", "谨慎", "胆怯", "怀疑", "恐慌", "不安全",
      "紧张", "偏执", "秘密", "颤抖", "害羞", "恐惧", "威胁", "胆小",
      "困住", "不确定", "不安", "脆弱", "想逃跑", "警惕", "担心", "压力",
    ],
  },
  {
    name: "欲望",
    index: 4,
    core: "渴望、永不满足",
    isRestrictive: true,
    keywords: [
      "期待", "渴望", "强迫性", "贪婪", "饥渴", "迫切", "嫉妒", "沉迷",
      "必须拥有", "永不满足", "占有欲", "自私", "无情",
    ],
  },
  {
    name: "愤怒",
    index: 5,
    core: "攻击、反抗",
    isRestrictive: true,
    keywords: [
      "粗暴", "攻击性", "恼火", "好斗", "愤怒", "沸腾", "挑衅", "苛刻",
      "反抗", "要求", "破坏性", "厌恶", "敌意", "嫉妒", "暴怒", "怨恨",
      "报复", "恶毒", "暴力", "固执", "生气", "烦躁",
    ],
  },
  {
    name: "骄傲",
    index: 6,
    core: "优越、评判",
    isRestrictive: true,
    keywords: [
      "傲慢", "自大", "自负", "鄙视", "优越感", "封闭", "自满", "轻蔑",
      "教条", "虚假谦虚", "伪善", "冰冷", "孤立", "评判", "自以为是",
      "狭隘", "自我吸收", "自我满足", "自命不凡", "顽固", "虚荣",
    ],
  },
  {
    name: "勇气",
    index: 7,
    core: "行动力、信心",
    isRestrictive: false,
    keywords: [
      "冒险", "警觉", "活力", "确信", "觉知", "居中", "清晰", "慈悲",
      "有信心", "创造性", "大胆", "果断", "动态", "热情", "兴奋", "专注",
      "给予", "快乐", "正直", "幽默", "独立", "主动", "爱", "清醒",
      "积极", "不抗拒", "开放", "乐观", "有目的", "接纳", "坚韧",
      "足智多谋", "安全", "自足", "自发", "强壮", "支持", "愿意",
    ],
  },
  {
    name: "接纳",
    index: 8,
    core: "满足、和谐",
    isRestrictive: false,
    keywords: [
      "丰盛", "感恩", "平衡", "美丽", "归属", "童真", "慈悲", "体贴",
      "喜悦", "拥抱", "共情", "充实", "一切都好", "友好", "圆满", "温柔",
      "光彩", "优雅", "和谐", "直觉", "合拍", "爱", "宽宏", "温和",
      "自然", "开放", "玩耍", "光芒", "安全", "柔软", "理解", "温暖",
      "幸福", "惊奇",
    ],
  },
  {
    name: "平静",
    index: 9,
    core: "合一、圆满",
    isRestrictive: false,
    keywords: [
      "永恒", "觉知", "存在", "无边界", "平静", "居中", "完整", "自由",
      "圆满", "光明", "合一", "完美", "纯净", "安静", "宁静", "空间",
      "寂静", "无限",
    ],
  },
];

export function buildEmotionTableText(): string {
  return EMOTION_LEVELS.map((level) =>
    `${level.index}. ${level.name}（核心：${level.core}）\n关键词：${level.keywords.join("、")}`
  ).join("\n\n");
}
