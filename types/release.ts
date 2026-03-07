export type EmotionLevel =
  | "冷漠"
  | "悲伤"
  | "恐惧"
  | "欲望"
  | "愤怒"
  | "骄傲"
  | "勇气"
  | "接纳"
  | "平静";

export type EmotionLevelIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface IdentifiedEmotion {
  words: string[];      // 中文展示词（context-aware 翻译）
  wordsEn?: string[];   // 官方英文原词
  wordsCn?: string[];   // 同 words，AI 输出字段名
  level: EmotionLevel;
  levelEn?: string;     // 英文层级名
  levelIndex: EmotionLevelIndex;
  aiReply: string;
  isKeywordSplit?: boolean; // true if split from multi-keyword identification, auto-advances without selection screen
}

export interface WantOption {
  label: string;
  description: string;
}

export type StepType = "open_text" | "yes_no" | "choice_2" | "choice_3" | "scale";

export type SessionStatus = "active" | "completed" | "abandoned";

export interface StepRecord {
  stepId: number;
  question: string;
  answer: string | number;
  timestamp: number;
}

export interface SessionState {
  id: string;
  startedAt: number;
  currentStep: number;
  identifiedEmotion: IdentifiedEmotion | null;
  intensityScore: number;
  selectedWant: WantOption | null;
  generatedWants: WantOption[];
  loopCount: number; // 步骤3-6的循环次数
  history: StepRecord[];
  status: SessionStatus;
  aiMessage: string | null; // 每步AI给的过渡提示
}

export interface SavedSession {
  id: string;
  startedAt: number;
  completedAt?: number;
  status: SessionStatus;
  identifiedEmotion: IdentifiedEmotion | null;
  summary: string;
  exitReason?: string;
  exitNotes?: string;
  bodyFeeling?: string;
}
