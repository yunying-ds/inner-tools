"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import type { SessionState, WantOption, SavedSession, IdentifiedEmotion } from "@/types/release";
import { FeedbackForm } from "@/components/release/FeedbackForm";
import { EmotionPicker } from "@/components/release/EmotionPicker";
import { EMOTION_LEVELS } from "@/lib/release/emotions";

const TOTAL_STEPS = 9;
const LOOP_WARNING_THRESHOLD = 3;
const MAX_LOOPS = 5;
const MAX_WANT_LOOPS = 10;

function createInitialSession(): SessionState {
  return {
    id: uuidv4(),
    startedAt: Date.now(),
    currentStep: 1,
    identifiedEmotion: null,
    intensityScore: 5,
    selectedWant: null,
    generatedWants: [],
    loopCount: 0,
    history: [],
    status: "active",
    aiMessage: null,
  };
}

function saveSessionToHistory(session: SessionState) {
  const saved: SavedSession = {
    id: session.id,
    startedAt: session.startedAt,
    completedAt: Date.now(),
    status: session.status,
    identifiedEmotion: session.identifiedEmotion,
    summary: session.identifiedEmotion
      ? `处理了${session.identifiedEmotion.level}情绪（${session.identifiedEmotion.words.join("、")}）`
      : "完成一次释放",
  };
  const existing = JSON.parse(localStorage.getItem("release_history") || "[]");
  localStorage.setItem("release_history", JSON.stringify([saved, ...existing]));
}

function getProgress(step: number): number {
  return Math.round((Math.min(step, TOTAL_STEPS) / TOTAL_STEPS) * 100);
}

const STEP_STAGE: Record<number, string> = {
  1: "感受觉察", 2: "感受觉察",
  3: "基础释放", 4: "基础释放", 5: "基础释放",
  6: "评估", 7: "深层想要", 9: "整合",
};

function splitEmotionToKeywords(emotion: IdentifiedEmotion): IdentifiedEmotion[] {
  const count = emotion.wordsEn?.length ?? emotion.words.length;
  if (count <= 1) return [emotion];
  return Array.from({ length: count }, (_, i) => ({
    ...emotion,
    wordsEn: emotion.wordsEn?.[i] != null ? [emotion.wordsEn[i]] : undefined,
    wordsCn: emotion.wordsCn?.[i] != null ? [emotion.wordsCn[i]] : undefined,
    words: [emotion.words[i] ?? emotion.words[0]],
    isKeywordSplit: true,
  }));
}

export default function SessionPage({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>(createInitialSession);
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");
  const [animKey, setAnimKey] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [emotionSelection, setEmotionSelection] = useState<IdentifiedEmotion[] | null>(null);
  const [remainingEmotions, setRemainingEmotions] = useState<IdentifiedEmotion[]>([]);
  const [nextEmotionOffer, setNextEmotionOffer] = useState<IdentifiedEmotion | null>(null);
  const [wantReidentifyMode, setWantReidentifyMode] = useState(false);
  const [wantReidentifyInput, setWantReidentifyInput] = useState("");
  const [manualEmotionPicker, setManualEmotionPicker] = useState(false);
  const [step9Feedback, setStep9Feedback] = useState<{ type: string; feedback: string; hasNewEmotion: boolean } | null>(null);
  const [pendingEmotion, setPendingEmotion] = useState<IdentifiedEmotion | null>(null);
  const [correctionMode, setCorrectionMode] = useState<null | "input" | "picker" | "self">(null);
  const [correctionInput, setCorrectionInput] = useState("");
  const [lastTextInput, setLastTextInput] = useState("");
  const [originalInput, setOriginalInput] = useState("");
  const [bodyGuidance, setBodyGuidance] = useState<string | null>(null);
  const [topicMode, setTopicMode] = useState<{ label: string; aiReply: string } | null>(null);
  const [selfInputMode, setSelfInputMode] = useState(false);
  const [selfInputWord, setSelfInputWord] = useState("");
  const [selfInputLevel, setSelfInputLevel] = useState<number | null>(null);
  const [summaryEntries, setSummaryEntries] = useState<{ emotion: IdentifiedEmotion; wants: WantOption[] }[]>([]);
  const [want7Phase, setWant7Phase] = useState<"select" | "letgo" | "check" | "return">("select");
  const [selected7Want, setSelected7Want] = useState<WantOption | null>(null);
  const [released7Wants, setReleased7Wants] = useState<string[]>([]);
  const [want7LoopCount, setWant7LoopCount] = useState(0);
  const [isManualEmotion, setIsManualEmotion] = useState(false);

  function captureEntry(emotion: IdentifiedEmotion | null, wants: WantOption[]) {
    if (!emotion) return;
    setSummaryEntries((prev) => [...prev, { emotion, wants }]);
  }

  const updateSession = useCallback((patch: Partial<SessionState>) => {
    setSession((prev) => ({ ...prev, ...patch }));
    setAnimKey((k) => k + 1);
  }, []);

  const FALLBACK_WANTS: WantOption[] = [
    { label: "想要被认同/被爱", description: "你想要被理解、被看见、被认同、被爱吗？" },
    { label: "想要控制", description: "你想要控制局面、让一切按你的计划进行吗？" },
    { label: "想要安全/生存", description: "你担心失去某些重要的东西、害怕未来没有保障吗？" },
  ];

  // 步骤7进入时自动加载想要选项
  const wantsLoadedRef = useRef(false);
  useEffect(() => {
    if (session.currentStep === 7 && session.generatedWants.length === 0 && !wantsLoadedRef.current) {
      wantsLoadedRef.current = true;
      if (isManualEmotion) {
        updateSession({ generatedWants: FALLBACK_WANTS });
      } else {
        loadWantOptions();
      }
    }
    if (session.currentStep !== 7) {
      wantsLoadedRef.current = false;
      setWantReidentifyMode(false);
      setWantReidentifyInput("");
      setWant7Phase("select");
      setSelected7Want(null);
      setReleased7Wants([]);
      setWant7LoopCount(0);
    }
  }, [session.currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 步骤1 ----
  async function handleStep1Submit() {
    if (!textInput.trim() || loading) return;
    setLoading(true);
    const input = textInput.trim();
    // Check input type first
    try {
      const typeRes = await fetch("/api/release/identify-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: input }),
      });
      if (typeRes.ok) {
        const typeData = await typeRes.json();
        setOriginalInput((prev) => prev || input);
        setLastTextInput(input);
        if (typeData.inputType === "body") {
          setBodyGuidance(input);
          setTextInput("");
          setLoading(false);
          setAnimKey((k) => k + 1);
          return;
        }
        if (typeData.inputType === "topic_event") {
          setTopicMode({ label: typeData.label, aiReply: typeData.aiReply });
          setTextInput("");
          setLoading(false);
          setAnimKey((k) => k + 1);
          return;
        }
      }
    } catch { /* fallback: proceed to identify-emotion */ }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch("/api/release/identify-emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ userInput: input }),
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setApiError(null);
      const historyEntry = { stepId: 1, question: "此刻你有什么感受？", answer: input, timestamp: Date.now() };
      if (data.allEmotions && data.allEmotions.length > 1) {
        setSession((prev) => ({ ...prev, aiMessage: data.aiReply, history: [...prev.history, historyEntry] }));
        setEmotionSelection(data.allEmotions.flatMap(splitEmotionToKeywords));
        setAnimKey((k) => k + 1);
      } else {
        const split = splitEmotionToKeywords(data);
        setSession((prev) => ({ ...prev, aiMessage: data.aiReply, history: [...prev.history, historyEntry] }));
        if (split.length > 1) {
          setEmotionSelection(split);
        } else {
          setPendingEmotion(split[0]);
        }
        setAnimKey((k) => k + 1);
      }
      setIsManualEmotion(false);
      setLastTextInput(input);
      setOriginalInput((prev) => prev || input);
      setTextInput("");
    } catch (e) {
      console.error(e);
      setApiError("AI 服务暂时不可用，请检查 API Key 或稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  async function handleStep1SubmitWithInput() {
    if (!textInput.trim() || loading) return;
    const input = textInput.trim();
    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch("/api/release/identify-emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ userInput: input }),
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setApiError(null);
      const historyEntry = { stepId: 1, question: "此刻你有什么感受？", answer: input, timestamp: Date.now() };
      setSession((prev) => ({ ...prev, aiMessage: data.aiReply, history: [...prev.history, historyEntry] }));
      if (data.allEmotions && data.allEmotions.length > 1) {
        setEmotionSelection(data.allEmotions.flatMap(splitEmotionToKeywords));
      } else {
        const split = splitEmotionToKeywords(data);
        if (split.length > 1) {
          setEmotionSelection(split);
        } else {
          setPendingEmotion(split[0]);
        }
      }
      setTopicMode(null);
      setBodyGuidance(null);
      setIsManualEmotion(false);
      setTextInput("");
      setAnimKey((k) => k + 1);
    } catch (e) {
      console.error(e);
      setApiError("AI 服务暂时不可用，请稍后重试。");
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  function handleSelectEmotionToRelease(emotion: IdentifiedEmotion) {
    const remaining = (emotionSelection || []).filter((e) => e !== emotion);
    const split = splitEmotionToKeywords(emotion);
    setRemainingEmotions((prev) => [...split.slice(1), ...remaining, ...prev]);
    setEmotionSelection(null);
    updateSession({ identifiedEmotion: split[0], aiMessage: null, currentStep: 2 });
  }

  function handleConfirmEmotion() {
    if (!pendingEmotion) return;
    setPendingEmotion(null);
    setCorrectionMode(null);
    updateSession({ identifiedEmotion: pendingEmotion, currentStep: 2 });
  }

  async function handleCorrectionSubmit() {
    if (!correctionInput.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/release/identify-emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: correctionInput }),
      });
      const data = await res.json();
      const corrected = { ...data, words: data.wordsCn ?? data.wordsEn ?? [] };
      const split = splitEmotionToKeywords(corrected);
      if (pendingEmotion !== null) {
        setPendingEmotion(split[0]);
      } else {
        updateSession({ identifiedEmotion: split[0] });
      }
      if (split.length > 1) setRemainingEmotions((prev) => [...split.slice(1), ...prev]);
      setCorrectionMode(null);
      setCorrectionInput("");
    } catch {
      // 静默失败
    } finally {
      setLoading(false);
    }
  }

  function handleCorrectionPick(emotion: IdentifiedEmotion) {
    const split = splitEmotionToKeywords(emotion);
    if (pendingEmotion !== null) {
      setPendingEmotion(split[0]);
    } else {
      updateSession({ identifiedEmotion: split[0] });
    }
    if (split.length > 1) setRemainingEmotions((prev) => [...split.slice(1), ...prev]);
    setCorrectionMode(null);
  }

  function handleSelfInputConfirm() {
    if (!selfInputWord.trim() || selfInputLevel === null) return;
    const level = EMOTION_LEVELS.find((l) => l.index === selfInputLevel)!;
    const emotion: IdentifiedEmotion = {
      words: [selfInputWord.trim()],
      wordsCn: [selfInputWord.trim()],
      level: level.name as IdentifiedEmotion["level"],
      levelEn: level.nameEn,
      levelIndex: level.index as IdentifiedEmotion["levelIndex"],
      aiReply: `好的，我们来释放「${selfInputWord.trim()}」。`,
    };
    setSelfInputMode(false);
    setSelfInputWord("");
    setSelfInputLevel(null);
    setIsManualEmotion(true);
    updateSession({
      identifiedEmotion: emotion,
      aiMessage: emotion.aiReply,
      history: [...session.history, { stepId: 1, question: "自行输入情绪", answer: `${level.name}：${selfInputWord.trim()}`, timestamp: Date.now() }],
      currentStep: 2,
    });
  }

  function handleManualEmotionSelect(emotion: IdentifiedEmotion) {
    setManualEmotionPicker(false);
    setIsManualEmotion(true);
    updateSession({
      identifiedEmotion: emotion,
      aiMessage: emotion.aiReply,
      history: [...session.history, { stepId: 1, question: "手动选择情绪", answer: `${emotion.level}：${emotion.words.join("、")}`, timestamp: Date.now() }],
      currentStep: 2,
    });
  }

  // ---- 退出 ----
  function handleExit() {
    captureEntry(session.identifiedEmotion, session.generatedWants);
    const emotionForRecord = session.identifiedEmotion ?? summaryEntries[summaryEntries.length - 1]?.emotion ?? null;
    const saved: SavedSession = {
      id: session.id,
      startedAt: session.startedAt,
      completedAt: Date.now(),
      status: "abandoned",
      identifiedEmotion: emotionForRecord,
      summary: emotionForRecord
        ? `中止了对「${emotionForRecord.words.join("、")}」的释放`
        : "中止了一次释放",
    };
    const existing = JSON.parse(localStorage.getItem("release_history") || "[]");
    localStorage.setItem("release_history", JSON.stringify([saved, ...existing]));
    router.back();
  }

  // ---- 步骤2-4 yes/no ----
  function handleYesNo(answer: "是" | "否") {
    const step = session.currentStep;
    const level = session.identifiedEmotion?.level ?? "感受";
    const questions: Record<number, string> = {
      2: `你能允许这份「${level}」存在吗？`,
      3: `你能让这份「${level}」离开吗？`,
      4: `你愿意让这份「${level}」离开吗？`,
    };
    const history = [...session.history, { stepId: step, question: questions[step] ?? "", answer, timestamp: Date.now() }];
    updateSession({ history, aiMessage: null, currentStep: step + 1 });
  }

  // ---- 步骤5 ----
  function handleChoice2(answer: "现在" | "稍后") {
    const history = [...session.history, { stepId: 5, question: "什么时候？", answer, timestamp: Date.now() }];
    updateSession({ history, aiMessage: null, currentStep: 6 });
  }

  // ---- 步骤6 ----
  function handleStep6Answer(hasMore: boolean) {
    const answer = hasMore ? "还有" : "没有了";
    const newHistory = [...session.history, { stepId: 6, question: `这份「${emotionLevel}」还有吗？`, answer, timestamp: Date.now() }];
    if (hasMore) {
      const newLoopCount = session.loopCount + 1;
      if (newLoopCount >= MAX_LOOPS) {
        updateSession({ loopCount: newLoopCount, history: newHistory, aiMessage: "感受持续存在，说明它可能有更深层的根源，让我们看看背后深层的渴望", currentStep: 7 });
      } else {
        updateSession({ loopCount: newLoopCount, history: newHistory, aiMessage: "嗯，还有一些，让我们再来一轮", currentStep: 3 });
      }
    } else {
      updateSession({ history: newHistory, currentStep: 7, aiMessage: null });
    }
  }

  // ---- 步骤7 ----
  async function loadWantOptions(overrideInput?: string) {
    setLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await fetch("/api/release/generate-wants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          emotionLevel: session.identifiedEmotion?.level,
          emotionWords: session.identifiedEmotion?.words ?? [],
          userInput: overrideInput ?? originalInput ?? session.history[0]?.answer ?? "",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const wants = Array.isArray(data.wants) && data.wants.length > 0 ? data.wants : FALLBACK_WANTS;
      updateSession({ generatedWants: wants });
    } catch (e) {
      console.error(e);
      updateSession({
        generatedWants: [
          { label: "想要被认同/被爱", description: "你想要被理解、被看见、被认同、被爱吗？" },
          { label: "想要控制", description: "你想要控制局面、让一切按你的计划进行吗？" },
          { label: "想要安全/生存", description: "你担心失去某些重要的东西、害怕未来没有保障吗？" },
        ],
      });
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  async function handleWantReidentifySubmit() {
    if (!wantReidentifyInput.trim() || loading) return;
    const input = wantReidentifyInput;
    setWantReidentifyMode(false);
    setWantReidentifyInput("");
    updateSession({ generatedWants: [] });
    await loadWantOptions(input);
  }

  function handleWantSelect(want: WantOption) {
    const newHistory = [...session.history, {
      stepId: 7,
      question: "释放想要：",
      answer: want.label,
      timestamp: Date.now(),
    }];
    setSession((prev) => ({ ...prev, selectedWant: want, history: newHistory }));
    setSelected7Want(want);
    setWant7Phase("letgo");
    setAnimKey((k) => k + 1);
  }

  function handleWant7Letgo() {
    if (!selected7Want) return;
    const newCount = want7LoopCount + 1;
    setWant7LoopCount(newCount);
    setReleased7Wants((prev) => [...prev, selected7Want.label]);
    if (newCount >= MAX_WANT_LOOPS) {
      handleFinishWants();
    } else {
      setWant7Phase("check");
      setAnimKey((k) => k + 1);
    }
  }

  function handleFinishWants() {
    captureEntry(session.identifiedEmotion, session.generatedWants);
    saveSessionToHistory({ ...session, status: "completed" });
    if (remainingEmotions.length > 0) {
      setNextEmotionOffer(remainingEmotions[0]);
      setRemainingEmotions(remainingEmotions.slice(1));
    } else {
      updateSession({ currentStep: 9, aiMessage: null });
    }
  }

  function handleSkipWants() {
    captureEntry(session.identifiedEmotion, []);
    saveSessionToHistory({ ...session, status: "completed" });
    if (remainingEmotions.length > 0) {
      setNextEmotionOffer(remainingEmotions[0]);
      setRemainingEmotions(remainingEmotions.slice(1));
    } else {
      updateSession({ currentStep: 9, aiMessage: null });
    }
  }

  // ---- 步骤9（可选记录） ----
  async function handleStep9Submit() {
    if (!textInput.trim()) {
      setCompletionMessage("这次释放完成了。");
      setCompleted(true);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/release/analyze-step9", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInput: textInput,
          currentEmotion: session.identifiedEmotion?.level ?? "情绪",
        }),
      });
      const data = await res.json();
      setStep9Feedback(data);
    } catch {
      setStep9Feedback({ type: "release_signal", feedback: "感谢你的记录，这次释放完成了。", hasNewEmotion: false });
    } finally {
      setLoading(false);
    }
  }

  function handleStep9Continue() {
    // 有新情绪：保留文字，重置进入下一轮
    const input = textInput;
    setStep9Feedback(null);
    setSession({ ...createInitialSession(), aiMessage: "有新的感受浮现，让我们继续。" });
    setEmotionSelection(null);
    setRemainingEmotions([]);
    setNextEmotionOffer(null);
    setTextInput(input);
    setAnimKey((k) => k + 1);
  }

  function handleStep9Complete() {
    setCompletionMessage("这次释放完成了。");
    setCompleted(true);
  }

  function handleStartNextEmotion(emotion: IdentifiedEmotion, remaining: IdentifiedEmotion[]) {
    wantsLoadedRef.current = false;
    setIsManualEmotion(false);
    setBodyGuidance(null);
    setTopicMode(null);
    setNextEmotionOffer(null);
    setRemainingEmotions(remaining);
    setSession({
      ...createInitialSession(),
      identifiedEmotion: emotion,
      aiMessage: `接下来我们来看看「${emotion.level}」。`,
      currentStep: 2,
    });
    setTextInput("");
    setAnimKey((k) => k + 1);
  }

  const step = session.currentStep;
  const emotionLevel = session.identifiedEmotion?.level ?? "感受";
  const emotionLabel = session.identifiedEmotion?.words.find((w) => w.trim()) || emotionLevel;

  // ---- 下一个情绪提示页 ----
  if (nextEmotionOffer) {
    const allOffered = [nextEmotionOffer, ...remainingEmotions];
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full space-y-6 step-animate">
          <div className="text-3xl text-muted-foreground text-center">✦</div>
          <h2 className="text-lg font-medium text-center">这份感受处理得差不多了。</h2>
          <p className="text-sm text-muted-foreground text-center">
            你刚才还提到了{allOffered.length > 1 ? "以下感受" : "另一份感受"}，要继续释放哪一个？
          </p>
          <div className="space-y-3">
            {allOffered.map((emotion) => {
              const others = allOffered.filter((e) => e !== emotion);
              return (
                <button
                  key={emotion.words[0] ?? emotion.level}
                  onClick={() => handleStartNextEmotion(emotion, others)}
                  className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 transition-all duration-200"
                >
                  <p className="font-semibold text-sm text-primary">
                    {emotion.level}{emotion.words[0] ? `：${emotion.words[0]}` : ""}
                  </p>
                  {emotion.words.length > 1 && (
                    <p className="text-xs text-muted-foreground mt-0.5">{emotion.words.slice(1).join("、")}</p>
                  )}
                </button>
              );
            })}
          </div>
          <Button variant="outline" className="w-full" onClick={() => {
            setNextEmotionOffer(null);
            setRemainingEmotions([]);
            setCompletionMessage("好的，今天就先到这里。");
            setCompleted(true);
          }}>结束本次</Button>
        </div>
      </div>
    );
  }

  // ---- 完成页 ----
  if (completed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full text-center space-y-6 step-animate">
          <div className="text-3xl text-muted-foreground">✦</div>
          <h2 className="text-lg font-medium">{completionMessage}</h2>

          {summaryEntries.length > 0 && (
            <div className="text-left space-y-3 pt-1">
              <p className="text-xs text-muted-foreground uppercase tracking-widest">这次你释放了</p>
              {summaryEntries.map((entry, i) => (
                <div key={i} className="border border-border rounded-xl px-4 py-3 space-y-1.5">
                  <p className="text-sm font-medium text-foreground">
                    {entry.emotion.level}
                    {entry.emotion.words.length > 0 && (
                      <span className="font-normal text-muted-foreground"> · {entry.emotion.words.join("、")}</span>
                    )}
                  </p>
                  {entry.wants.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      背后的想要：{entry.wants.map((w) => w.label).join("、")}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          <FeedbackForm />
          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={() => {
              setSession(createInitialSession());
              setCompleted(false);
              setTextInput("");
              setEmotionSelection(null);
              setRemainingEmotions([]);
              setNextEmotionOffer(null);
            }}>
              开始新一轮
            </Button>
            <Button variant="outline" onClick={() => router.push("/release/history")}>
              查看历史记录
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 顶部进度 */}
      <div className="px-4 pt-6 pb-2 max-w-lg mx-auto w-full">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <button onClick={() => step === 1 ? (onBack ? onBack() : router.back()) : router.back()} className="hover:text-foreground transition-colors">← 返回</button>
          <span>{Math.min(step, TOTAL_STEPS)} / {TOTAL_STEPS}</span>
          <button
            onClick={handleExit}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            退出
          </button>
        </div>
        <Progress value={getProgress(step)} className="h-0.5" />
      </div>

      {/* API 错误提示 */}
      {apiError && (
        <div className="px-4 max-w-lg mx-auto w-full">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-2.5">
            <span>{apiError}</span>
            <button onClick={() => setApiError(null)} className="shrink-0 opacity-60 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      {/* 主内容 */}
      <div className="flex-1 flex items-start justify-center px-6 pt-10">
        <div key={animKey} className="step-animate max-w-lg w-full space-y-6">

          {/* 正常步骤内容 */}
          {<>

          {/* 已识别情绪标签 */}
          {session.identifiedEmotion && step > 1 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-block text-sm font-semibold px-3 py-1 rounded-full bg-primary/12 text-primary border border-primary/25">
                  {session.identifiedEmotion.level}
                  {session.identifiedEmotion.words[0] && `：${session.identifiedEmotion.words[0]}`}
                  {session.identifiedEmotion.wordsEn?.[0] && (
                    <span className="font-normal opacity-55 ml-1">({session.identifiedEmotion.wordsEn[0]})</span>
                  )}
                </span>
                {!correctionMode && (
                  <button
                    onClick={() => setCorrectionMode("input")}
                    className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    不准确？
                  </button>
                )}
              </div>
              {session.identifiedEmotion.words.length > 1 && !correctionMode && (
                <div className="flex gap-2 flex-wrap">
                  {session.identifiedEmotion.words.slice(1).map((w, i) => (
                    <span key={w} className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-foreground/70">
                      {w}
                      {session.identifiedEmotion!.wordsEn?.[i + 1] && (
                        <span className="opacity-55 ml-1">({session.identifiedEmotion!.wordsEn![i + 1]})</span>
                      )}
                    </span>
                  ))}
                </div>
              )}

              {/* 纠正：重新描述 */}
              {correctionMode === "input" && (
                <div className="space-y-2 pt-1">
                  <textarea
                    className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                    placeholder="重新描述你的感受，AI 会重新识别……"
                    rows={2}
                    value={correctionInput}
                    onChange={(e) => setCorrectionInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCorrectionSubmit(); } }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCorrectionSubmit} disabled={!correctionInput.trim() || loading}>
                      {loading ? "识别中…" : "重新识别"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCorrectionMode("picker")}>
                      自己选
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setCorrectionMode(null); setCorrectionInput(""); }}>
                      取消
                    </Button>
                  </div>
                </div>
              )}

              {/* 纠正：手动选择 */}
              {correctionMode === "picker" && (
                <div className="pt-1">
                  <EmotionPicker
                    onSelect={handleCorrectionPick}
                    onCancel={() => setCorrectionMode(null)}
                  />
                </div>
              )}
            </div>
          )}

          {/* AI 过渡提示 */}
          {session.aiMessage && (
            <p className="text-base text-foreground/80 leading-relaxed">{session.aiMessage}</p>
          )}

          {/* 步骤1：AI识别后确认屏 */}
          {step === 1 && pendingEmotion && !correctionMode && (
            <div className="space-y-5">
              <div>
                <button
                  onClick={() => { setPendingEmotion(null); setTextInput(lastTextInput); setCorrectionMode(null); setAnimKey((k) => k + 1); }}
                  className="text-sm text-muted-foreground/50 hover:text-muted-foreground mb-3 flex items-center gap-1 transition-colors"
                >
                  ← 继续编辑
                </button>
                <p className="text-sm text-muted-foreground mb-3">{session.aiMessage}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-block text-sm font-semibold px-3 py-1 rounded-full bg-primary/12 text-primary border border-primary/25">
                    {pendingEmotion.level}
                    {pendingEmotion.words[0] && `：${pendingEmotion.words[0]}`}
                    {pendingEmotion.wordsEn?.[0] && (
                      <span className="font-normal opacity-55 ml-1">({pendingEmotion.wordsEn[0]})</span>
                    )}
                  </span>
                  {pendingEmotion.words.slice(1).map((w, i) => (
                    <span key={w} className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-foreground/70">
                      {w}
                      {pendingEmotion.wordsEn?.[i + 1] && (
                        <span className="opacity-55 ml-1">({pendingEmotion.wordsEn[i + 1]})</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
              <Button className="w-full" onClick={handleConfirmEmotion}>
                就是这个，开始释放
              </Button>
              <div className="flex justify-center gap-4">
                <button onClick={() => setCorrectionMode("input")} className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors">重新描述</button>
                <span className="text-muted-foreground/30 text-sm">·</span>
                <button onClick={() => setCorrectionMode("picker")} className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors">从情绪表选</button>
                <span className="text-muted-foreground/30 text-sm">·</span>
                <button onClick={() => setCorrectionMode("self")} className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors">直接输入</button>
              </div>
            </div>
          )}

          {/* 步骤1：确认屏的纠正模式 */}
          {step === 1 && pendingEmotion && correctionMode === "input" && (
            <div className="space-y-3">
              <button onClick={() => setCorrectionMode(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">← 返回</button>
              <textarea
                className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder="重新描述你的感受……"
                rows={2}
                value={correctionInput}
                onChange={(e) => setCorrectionInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCorrectionSubmit(); } }}
              />
              <Button size="sm" onClick={handleCorrectionSubmit} disabled={!correctionInput.trim() || loading}>
                {loading ? "识别中…" : "重新识别"}
              </Button>
            </div>
          )}
          {step === 1 && pendingEmotion && correctionMode === "picker" && (
            <EmotionPicker onSelect={handleCorrectionPick} onCancel={() => setCorrectionMode(null)} />
          )}
          {step === 1 && pendingEmotion && correctionMode === "self" && (
            <div className="space-y-4">
              <button onClick={() => setCorrectionMode(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">← 返回</button>
              <input
                type="text"
                className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder="用你自己的词……"
                value={selfInputWord}
                onChange={(e) => setSelfInputWord(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {EMOTION_LEVELS.map((l) => (
                  <button key={l.index} onClick={() => setSelfInputLevel(l.index)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-150 ${selfInputLevel === l.index ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>
                    {l.name}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={() => {
                if (!selfInputWord.trim() || selfInputLevel === null) return;
                const level = EMOTION_LEVELS.find((l) => l.index === selfInputLevel)!;
                handleCorrectionPick({ words: [selfInputWord.trim()], wordsCn: [selfInputWord.trim()], level: level.name as IdentifiedEmotion["level"], levelEn: level.nameEn, levelIndex: level.index as IdentifiedEmotion["levelIndex"], aiReply: "" });
                setSelfInputWord(""); setSelfInputLevel(null);
              }} disabled={!selfInputWord.trim() || selfInputLevel === null}>确认</Button>
            </div>
          )}

          {/* 步骤1：手动选择情绪 */}
          {step === 1 && manualEmotionPicker && (
            <EmotionPicker
              onSelect={handleManualEmotionSelect}
              onCancel={() => setManualEmotionPicker(false)}
            />
          )}

          {/* 步骤1：自行输入情绪（老手模式） */}
          {step === 1 && selfInputMode && (
            <div className="space-y-4">
              <div>
                <button
                  onClick={() => { setSelfInputMode(false); setSelfInputWord(""); setSelfInputLevel(null); }}
                  className="text-sm text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1"
                >
                  ← 返回
                </button>
                <h2 className="text-lg font-medium leading-snug">你感受到的是什么？</h2>
              </div>
              <input
                type="text"
                className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder="用你自己的词描述，比如：委屈、对自己失望……"
                value={selfInputWord}
                onChange={(e) => setSelfInputWord(e.target.value)}
              />
              <div>
                <p className="text-sm text-muted-foreground mb-2">它属于哪个层级？</p>
                <div className="flex flex-wrap gap-2">
                  {EMOTION_LEVELS.map((l) => (
                    <button
                      key={l.index}
                      onClick={() => setSelfInputLevel(l.index)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-150 ${
                        selfInputLevel === l.index
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleSelfInputConfirm}
                disabled={!selfInputWord.trim() || selfInputLevel === null}
              >
                开始释放
              </Button>
            </div>
          )}

          {/* 步骤1：事件/话题引导 */}
          {step === 1 && topicMode && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">{topicMode.aiReply}</p>
              <Textarea
                placeholder="描述你此刻的感受……"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={3}
                className="resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleStep1SubmitWithInput(); }
                }}
              />
              <Button className="w-full" onClick={handleStep1SubmitWithInput} disabled={!textInput.trim() || loading}>
                {loading ? "识别中……" : "继续"}
              </Button>
              <button
                onClick={() => { setTopicMode(null); setTextInput(lastTextInput); }}
                className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground text-center py-1 transition-colors"
              >
                返回重新输入
              </button>
            </div>
          )}

          {/* 步骤1：身体感受引导 */}
          {step === 1 && bodyGuidance && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                身体往往储存了我们还未被意识到的情绪。
              </p>
              <h2 className="text-lg font-medium leading-snug">
                「{bodyGuidance}」储存的情绪可能是？
              </h2>
              <Textarea
                placeholder="如果让这个身体部位说话，它会说什么？"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={3}
                className="resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleStep1SubmitWithInput(); }
                }}
              />
              <Button className="w-full" onClick={handleStep1SubmitWithInput} disabled={!textInput.trim() || loading}>
                {loading ? "识别中……" : "继续"}
              </Button>
              <button
                onClick={() => { setBodyGuidance(null); setTextInput(bodyGuidance); }}
                className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground text-center py-1 transition-colors"
              >
                返回重新输入
              </button>
            </div>
          )}

          {/* 步骤1：输入 */}
          {step === 1 && !bodyGuidance && !topicMode && !emotionSelection && !manualEmotionPicker && !selfInputMode && !pendingEmotion && (
            <div className="space-y-3">
              <StepOpenText
                question="此刻你有什么感受？"
                placeholder="可以描述最近发生的一件事、一直在脑海里转的念头，身体某个部位的感觉，或是对某个目标的感受……"
                value={textInput}
                onChange={setTextInput}
                onSubmit={handleStep1Submit}
                loading={loading}
              />
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setManualEmotionPicker(true)}
                  className="text-sm text-muted-foreground/60 hover:text-muted-foreground py-1 transition-colors"
                >
                  从情绪表选
                </button>
                <span className="text-muted-foreground/30 text-sm">·</span>
                <button
                  onClick={() => setSelfInputMode(true)}
                  className="text-sm text-muted-foreground/60 hover:text-muted-foreground py-1 transition-colors"
                >
                  直接输入
                </button>
              </div>
            </div>
          )}

          {/* 步骤1：检测到多种情绪，让用户选择 */}
          {step === 1 && emotionSelection && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-medium leading-snug">你想先释放哪个？</h2>
                <p className="text-sm text-muted-foreground mt-1">点击你此刻最想处理的那份感受</p>
              </div>
              <div className="space-y-3">
                {emotionSelection.map((emotion) => (
                  <button
                    key={emotion.words[0] ?? emotion.level}
                    onClick={() => handleSelectEmotionToRelease(emotion)}
                    className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 transition-all duration-200 space-y-1"
                  >
                    <p className="text-xs text-muted-foreground/70 mb-0.5">
                      {emotion.level}{emotion.levelEn && <span className="ml-1">({emotion.levelEn})</span>}
                    </p>
                    <p className="font-semibold text-sm text-primary">
                      {emotion.words[0]}
                      {emotion.wordsEn?.[0] && <span className="font-normal opacity-55 ml-1">({emotion.wordsEn[0]})</span>}
                    </p>
                    {emotion.words.length > 1 && (
                      <p className="text-xs text-muted-foreground">
                        {emotion.words.slice(1).map((w, i) => (
                          <span key={i}>{i > 0 && "、"}{w}{emotion.wordsEn?.[i + 1] && <span className="opacity-55 ml-0.5">({emotion.wordsEn[i + 1]})</span>}</span>
                        ))}
                      </p>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex justify-center gap-4 pt-1">
                <button
                  onClick={() => { setEmotionSelection(null); setTextInput(lastTextInput); }}
                  className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  重新描述
                </button>
                <span className="text-muted-foreground/30 text-sm">·</span>
                <button
                  onClick={() => { setEmotionSelection(null); setManualEmotionPicker(true); }}
                  className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  从情绪表选
                </button>
                <span className="text-muted-foreground/30 text-sm">·</span>
                <button
                  onClick={() => { setEmotionSelection(null); setSelfInputMode(true); }}
                  className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  直接输入
                </button>
              </div>
            </div>
          )}

          {/* 步骤2 */}
          {step === 2 && (
            <div className="space-y-4">
              <StepYesNo
                question={`你能允许这份「${emotionLabel}」就这样存在吗？`}
                subtext="Could you let this feeling be here? · 先感受一下它在身体的哪里"
                onAnswer={handleYesNo}
              />
              <button
                onClick={() => updateSession({ currentStep: 7 })}
                className="w-full text-xs text-muted-foreground/40 hover:text-muted-foreground/60 text-center py-1 transition-colors"
              >
                跳过，直接识别「三大想要」
              </button>
            </div>
          )}

          {/* 步骤3 */}
          {step === 3 && (
            <div className="space-y-4">
              <StepYesNo
                question={`你能让这份「${emotionLabel}」离开吗？`}
                subtext="Could you let it go?"
                onAnswer={handleYesNo}
              />
              <button
                onClick={() => updateSession({ currentStep: 7 })}
                className="w-full text-xs text-muted-foreground/40 hover:text-muted-foreground/60 text-center py-1 transition-colors"
              >
                跳过，直接识别「三大想要」
              </button>
            </div>
          )}

          {/* 步骤4 */}
          {step === 4 && (
            <div className="space-y-4">
              <StepYesNo
                question={`你愿意让这份「${emotionLabel}」离开吗？`}
                subtext="Would you let it go?"
                onAnswer={handleYesNo}
              />
              <button
                onClick={() => updateSession({ currentStep: 7 })}
                className="w-full text-xs text-muted-foreground/40 hover:text-muted-foreground/60 text-center py-1 transition-colors"
              >
                跳过，直接识别「三大想要」
              </button>
            </div>
          )}

          {/* 步骤5 */}
          {step === 5 && (
            <div className="space-y-4">
              <StepWhen
                note={`即使外部情况没变，内心的「${emotionLabel}」可以现在就松开。`}
                onAnswer={handleChoice2}
              />
              <button
                onClick={() => updateSession({ currentStep: 7 })}
                className="w-full text-xs text-muted-foreground/40 hover:text-muted-foreground/60 text-center py-1 transition-colors"
              >
                跳过，直接识别「三大想要」
              </button>
            </div>
          )}

          {/* 步骤6 */}
          {step === 6 && (
            <div className="space-y-5">
              <h2 className="text-lg font-medium">这份「{emotionLabel}」还有吗？</h2>
              {session.loopCount >= LOOP_WARNING_THRESHOLD && (
                <p className="text-xs text-muted-foreground">这个议题可能比较深层，你也可以先停下来，让自己休息一下。</p>
              )}
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => handleStep6Answer(true)}>还有，继续释放</Button>
                <Button variant="outline" className="flex-1" onClick={() => handleStep6Answer(false)}>没有了，下一步</Button>
              </div>
            </div>
          )}

          {/* 步骤7：重新识别想要 */}
          {step === 7 && wantReidentifyMode && (
            <StepOpenText
              question="在这件事里，你最希望得到什么？"
              subtext="换个角度来看——如果这件事能按你心意发展，那会是什么样？"
              placeholder="用自己的话说就好，比如「希望他能理解我」……"
              value={wantReidentifyInput}
              onChange={setWantReidentifyInput}
              onSubmit={handleWantReidentifySubmit}
              loading={loading}
            />
          )}

          {/* 步骤7：select */}
          {step === 7 && !wantReidentifyMode && want7Phase === "select" && (
            <div className="space-y-5">
              <h2 className="text-lg font-medium">在这份「{emotionLabel}」背后，你最想要的是……</h2>
              {loading && <p className="text-sm text-muted-foreground">正在感应……</p>}
              <div className="space-y-3">
                {session.generatedWants.map((w) => (
                  <button
                    key={w.label}
                    onClick={() => handleWantSelect(w)}
                    className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 active:bg-primary/5 transition-all duration-200 space-y-1.5"
                  >
                    <p className="font-medium text-sm">{w.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{w.description}</p>
                  </button>
                ))}
                {!loading && session.generatedWants.length > 0 && (
                  <button
                    onClick={() => { setWantReidentifyMode(true); setAnimKey((k) => k + 1); }}
                    className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground text-center py-2 transition-colors"
                  >
                    这些都不太准确，换个角度识别
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 步骤7：letgo */}
          {step === 7 && !wantReidentifyMode && want7Phase === "letgo" && selected7Want && (
            <div className="space-y-5">
              <h2 className="text-lg font-medium">可以让这个「{selected7Want.label}」离开吗？</h2>
              <p className="text-xs text-muted-foreground">无论你的答案是什么，注意到它就是在释放。</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={handleWant7Letgo}>可以</Button>
                <Button variant="outline" className="flex-1" onClick={handleWant7Letgo}>不可以</Button>
              </div>
            </div>
          )}

          {/* 步骤7：check */}
          {step === 7 && !wantReidentifyMode && want7Phase === "check" && (
            <div className="space-y-5">
              <h2 className="text-lg font-medium">「{emotionLabel}」背后还有……</h2>
              <div className="space-y-3">
                {session.generatedWants.map((w) => (
                  <button
                    key={w.label}
                    onClick={() => handleWantSelect(w)}
                    className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 active:bg-primary/5 transition-all duration-200 space-y-1.5"
                  >
                    <p className="font-medium text-sm">{w.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{w.description}</p>
                  </button>
                ))}
                <Button variant="outline" className="w-full" onClick={() => {
                  if (remainingEmotions.length > 0) {
                    handleFinishWants();
                  } else {
                    setWant7Phase("return");
                    setAnimKey((k) => k + 1);
                  }
                }}>没有了</Button>
              </div>
            </div>
          )}

          {/* 步骤7：return */}
          {step === 7 && !wantReidentifyMode && want7Phase === "return" && (
            <div className="space-y-5">
              <h2 className="text-lg font-medium leading-snug">
                关于「{originalInput || emotionLabel}」，还有什么感受吗？
              </h2>
              <div className="space-y-3">
                <Textarea
                  placeholder="描述你此刻的感受……"
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && textInput.trim()) {
                      e.preventDefault();
                      captureEntry(session.identifiedEmotion, session.generatedWants);
                      setWant7Phase("select");
                      setReleased7Wants([]);
                      setWant7LoopCount(0);
                      updateSession({ currentStep: 1, identifiedEmotion: null, generatedWants: [] });
                    }
                  }}
                />
                <Button className="w-full" disabled={!textInput.trim()} onClick={() => {
                  captureEntry(session.identifiedEmotion, session.generatedWants);
                  setWant7Phase("select");
                  setReleased7Wants([]);
                  setWant7LoopCount(0);
                  updateSession({ currentStep: 1, identifiedEmotion: null, generatedWants: [] });
                }}>继续</Button>
                <Button variant="outline" className="w-full" onClick={handleFinishWants}>没有了，完成本次释放</Button>
              </div>
            </div>
          )}

          {/* 步骤9：可选记录 */}
          {step === 9 && !step9Feedback && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium leading-snug">此刻有什么感受？</h2>
              <p className="text-sm text-muted-foreground">可以描述身体的反应、浮现的念头，或是什么都没有。不写也可以直接完成。</p>
              <Textarea
                placeholder="比如：打了个哈欠、身体轻了一点、脑子里还有一件事……"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={4}
                className="resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && textInput.trim() && !loading) {
                    e.preventDefault();
                    handleStep9Submit();
                  }
                }}
              />
              <Button className="w-full" onClick={handleStep9Submit} disabled={loading}>
                {loading ? "感应中……" : textInput.trim() ? "提交" : "完成"}
              </Button>
            </div>
          )}

          {/* 步骤9：AI 反馈 */}
          {step === 9 && step9Feedback && (
            <div className="space-y-5">
              <p className="text-base text-foreground/90 leading-relaxed">{step9Feedback.feedback}</p>
              {step9Feedback.hasNewEmotion ? (
                <div className="space-y-2">
                  <Button className="w-full" onClick={handleStep9Continue}>
                    继续释放新的感受
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={handleStep9Complete}>
                    先到这里，完成
                  </Button>
                </div>
              ) : (
                <Button className="w-full" onClick={handleStep9Complete}>
                  完成
                </Button>
              )}
            </div>
          )}
          </>}
        </div>
      </div>
    </div>
  );
}

// ---- 子组件 ----

function BreathingCue() {
  return (
    <div className="flex justify-center py-4">
      <div className="breathe-circle w-14 h-14 rounded-full bg-primary/20" />
    </div>
  );
}

function StepOpenText({
  question, subtext, placeholder, value, onChange, onSubmit, loading,
}: {
  question: string; subtext?: string; placeholder?: string;
  value: string; onChange: (v: string) => void; onSubmit: () => void; loading: boolean;
}) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium leading-snug">{question}</h2>
      {subtext && <p className="text-sm text-muted-foreground">{subtext}</p>}
      <Textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="resize-none text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); }
        }}
      />
      <Button className="w-full" onClick={onSubmit} disabled={!value.trim() || loading}>
        {loading ? "感应中……" : "继续"}
      </Button>
    </div>
  );
}

function StepYesNo({ question, subtext, onAnswer }: {
  question: string; subtext?: string; onAnswer: (answer: "是" | "否") => void;
}) {
  return (
    <div className="space-y-5">
      <BreathingCue />
      <h2 className="text-lg font-medium leading-snug">{question}</h2>
      {subtext && <p className="text-sm text-muted-foreground">{subtext}</p>}
      <div className="flex gap-3">
        <Button className="flex-1" onClick={() => onAnswer("是")}>是</Button>
        <Button className="flex-1" variant="outline" onClick={() => onAnswer("否")}>否</Button>
      </div>
    </div>
  );
}

function StepWhen({ onAnswer, note }: { onAnswer: (answer: "现在" | "稍后") => void; note?: string }) {
  return (
    <div className="space-y-5">
      <BreathingCue />
      <h2 className="text-lg font-medium">什么时候？</h2>
      <p className="text-sm text-muted-foreground">When?</p>
      {note && (
        <p className="text-sm text-muted-foreground/80 leading-relaxed border-l-2 border-primary/30 pl-3">{note}</p>
      )}
      <div className="flex gap-3">
        <Button className="flex-1" onClick={() => onAnswer("现在")}>现在</Button>
        <Button className="flex-1" variant="outline" onClick={() => onAnswer("稍后")}>稍后</Button>
      </div>
    </div>
  );
}
