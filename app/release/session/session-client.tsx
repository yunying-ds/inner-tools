"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import type { SessionState, WantOption, SavedSession, IdentifiedEmotion } from "@/types/release";

const TOTAL_STEPS = 9;
const LOOP_WARNING_THRESHOLD = 3;
const MAX_LOOPS = 3;

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
  6: "评估", 7: "深层想要", 8: "深层释放", 9: "整合",
};

type WantPhase = "allow" | "could" | "would" | "when";
const WANT_PHASES: WantPhase[] = ["allow", "could", "would", "when"];

export default function SessionPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>(createInitialSession);
  const [textInput, setTextInput] = useState("");
  const [sliderValue, setSliderValue] = useState([5]);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [completionMessage, setCompletionMessage] = useState("");
  const [askLoopAgain, setAskLoopAgain] = useState(false);
  const [wantPhaseIndex, setWantPhaseIndex] = useState(0);
  const [wantLoopCount, setWantLoopCount] = useState(0);
  const [wantCheckPhase, setWantCheckPhase] = useState<null | "same" | "others">(null);
  // 多选想要：按用户点击顺序排序（index 0 = 最强烈）
  const [rankedWants, setRankedWants] = useState<WantOption[]>([]);
  const [currentWantRankIndex, setCurrentWantRankIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const [apiError, setApiError] = useState<string | null>(null);
  const [emotionSelection, setEmotionSelection] = useState<IdentifiedEmotion[] | null>(null);
  const [remainingEmotions, setRemainingEmotions] = useState<IdentifiedEmotion[]>([]);
  const [nextEmotionOffer, setNextEmotionOffer] = useState<IdentifiedEmotion | null>(null);
  const [exitFlow, setExitFlow] = useState<null | "reason" | "notes">(null);
  const [exitReason, setExitReason] = useState("");
  const [exitNotes, setExitNotes] = useState("");

  const updateSession = useCallback((patch: Partial<SessionState>) => {
    setSession((prev) => ({ ...prev, ...patch }));
    setAnimKey((k) => k + 1);
  }, []);

  // 步骤7进入时自动加载想要选项
  const wantsLoadedRef = useRef(false);
  useEffect(() => {
    if (session.currentStep === 7 && session.generatedWants.length === 0 && !wantsLoadedRef.current) {
      wantsLoadedRef.current = true;
      loadWantOptions();
    }
    if (session.currentStep !== 7) wantsLoadedRef.current = false;
  }, [session.currentStep]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 步骤1 ----
  async function handleStep1Submit() {
    if (!textInput.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/release/identify-emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: textInput }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setApiError(null);
      const historyEntry = { stepId: 1, question: "此刻你有什么感受？", answer: textInput, timestamp: Date.now() };
      if (data.allEmotions && data.allEmotions.length > 1) {
        setSession((prev) => ({ ...prev, aiMessage: data.aiReply, history: [...prev.history, historyEntry] }));
        setEmotionSelection(data.allEmotions);
        setAnimKey((k) => k + 1);
      } else {
        updateSession({
          identifiedEmotion: data,
          aiMessage: data.aiReply,
          history: [...session.history, historyEntry],
          currentStep: 2,
        });
      }
      setTextInput("");
    } catch (e) {
      console.error(e);
      setApiError("AI 服务暂时不可用，请检查 API Key 或稍后重试。");
    } finally {
      setLoading(false);
    }
  }

  function handleSelectEmotionToRelease(emotion: IdentifiedEmotion) {
    const remaining = (emotionSelection || []).filter((e) => e.level !== emotion.level);
    setRemainingEmotions(remaining);
    setEmotionSelection(null);
    updateSession({ identifiedEmotion: emotion, aiMessage: null, currentStep: 2 });
  }

  // ---- 退出流程 ----
  function handleExitReason(reason: string) {
    setExitReason(reason);
    setExitFlow("notes");
    setAnimKey((k) => k + 1);
  }

  function handleExitConfirm() {
    const saved: SavedSession = {
      id: session.id,
      startedAt: session.startedAt,
      completedAt: Date.now(),
      status: "abandoned",
      identifiedEmotion: session.identifiedEmotion,
      summary: session.identifiedEmotion
        ? `中止了对「${session.identifiedEmotion.level}」的释放`
        : "中止了一次释放",
      exitReason,
      exitNotes: exitNotes.trim() || undefined,
    };
    const existing = JSON.parse(localStorage.getItem("release_history") || "[]");
    localStorage.setItem("release_history", JSON.stringify([saved, ...existing]));
    setExitFlow(null);
    setCompletionMessage(
      exitReason === "觉得差不多了，不需要走完"
        ? "好的，已记录这次释放。"
        : "已记录，随时可以回来继续。"
    );
    setCompleted(true);
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
  function handleScoreSubmit() {
    const score = sliderValue[0];
    const newHistory = [...session.history, { stepId: 6, question: "此刻强度评分（0-10）", answer: score, timestamp: Date.now() }];
    // 和上一轮评分比较，判断是否有改善
    const prevScores = session.history.filter(h => h.stepId === 6).map(h => Number(h.answer));
    const lastScore = prevScores.at(-1) ?? null;
    const notImproving = lastScore !== null && score >= lastScore;
    if (score >= 5) {
      const newLoopCount = session.loopCount + 1;
      if (notImproving || newLoopCount >= MAX_LOOPS) {
        updateSession({ intensityScore: score, loopCount: newLoopCount, history: newHistory, aiMessage: "感受没有减轻，说明它可能有更深层的根源，让我们换个角度来处理", currentStep: 7 });
      } else {
        updateSession({ intensityScore: score, loopCount: newLoopCount, history: newHistory, aiMessage: "嗯，还有一些，让我们再来一轮", currentStep: 3 });
      }
      setSliderValue([5]);
    } else if (score >= 3) {
      if (notImproving) {
        updateSession({ intensityScore: score, history: newHistory, aiMessage: "感受的强度变化不大，让我们试试更深层的释放", currentStep: 7 });
      } else {
        setSession((prev) => ({ ...prev, intensityScore: score, history: newHistory }));
        setAskLoopAgain(true);
        setAnimKey((k) => k + 1);
      }
    } else {
      updateSession({ intensityScore: score, history: newHistory, aiMessage: "很好，感受轻了不少", currentStep: 7 });
    }
  }

  function handleLoopAgain(again: boolean) {
    setAskLoopAgain(false);
    if (again) {
      updateSession({ loopCount: session.loopCount + 1, aiMessage: "好的，我们再来一轮", currentStep: 3 });
      setSliderValue([5]);
    } else {
      updateSession({ currentStep: 7, aiMessage: null });
    }
  }

  // ---- 步骤7 ----
  async function loadWantOptions() {
    setLoading(true);
    try {
      const res = await fetch("/api/release/generate-wants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emotionLevel: session.identifiedEmotion?.level,
          emotionWords: session.identifiedEmotion?.words ?? [],
          userInput: session.history[0]?.answer ?? "",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      updateSession({ generatedWants: data.wants });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function handleToggleWant(want: WantOption) {
    setRankedWants((prev) => {
      const idx = prev.findIndex((w) => w.label === want.label);
      return idx >= 0 ? prev.filter((_, i) => i !== idx) : [...prev, want];
    });
  }

  function handleConfirmWants() {
    if (rankedWants.length === 0) return;
    const history = [...session.history, {
      stepId: 7,
      question: "在这个感受背后，你最想要的是：",
      answer: rankedWants.map((w) => w.label).join("、"),
      timestamp: Date.now(),
    }];
    setCurrentWantRankIndex(0);
    setWantPhaseIndex(0);
    setWantCheckPhase(null);
    updateSession({ selectedWant: rankedWants[0], history, currentStep: 8 });
  }

  // ---- 步骤8 子阶段 ----
  function handleWantPhaseAnswer(answer: "是" | "否") {
    const phase = WANT_PHASES[wantPhaseIndex];
    const wantLabel = session.selectedWant?.label ?? "这个想要";
    const questions: Record<WantPhase, string> = {
      allow: `你能允许「${wantLabel}」就这样存在吗？`,
      could: `你能让「${wantLabel}」离开吗？`,
      would: `你愿意放下「${wantLabel}」吗？`,
      when: "",
    };
    const newHistory = [...session.history, { stepId: 8, question: questions[phase], answer, timestamp: Date.now() }];
    if (wantPhaseIndex < WANT_PHASES.length - 1) {
      setWantPhaseIndex((i) => i + 1);
      setSession((prev) => ({ ...prev, history: newHistory }));
      setAnimKey((k) => k + 1);
    } else {
      setSession((prev) => ({ ...prev, history: newHistory }));
      setWantCheckPhase("same");
      setAnimKey((k) => k + 1);
    }
  }

  function handleWantWhen(answer: "现在" | "稍后") {
    const newHistory = [...session.history, { stepId: 8, question: "什么时候？", answer, timestamp: Date.now() }];
    setSession((prev) => ({ ...prev, history: newHistory }));
    setWantCheckPhase("same");
    setAnimKey((k) => k + 1);
  }

  const MAX_WANT_LOOPS = 3;

  // ---- 步骤8 想要检查 ----
  function handleWantCheckSame(answer: "是" | "否") {
    if (answer === "是") {
      const newCount = wantLoopCount + 1;
      if (newCount >= MAX_WANT_LOOPS) {
        // 循环次数达到上限，进入下一个想要或步骤9
        setWantLoopCount(0);
        setWantCheckPhase("others");
        setAnimKey((k) => k + 1);
      } else {
        setWantLoopCount(newCount);
        setWantPhaseIndex(0);
        setWantCheckPhase(null);
        setAnimKey((k) => k + 1);
      }
    } else {
      setWantCheckPhase("others");
      setAnimKey((k) => k + 1);
    }
  }

  function handleWantCheckOthers(answer: "是" | "否") {
    const nextRankIndex = currentWantRankIndex + 1;
    const nextWant = rankedWants[nextRankIndex];
    if (answer === "是" && nextWant) {
      setCurrentWantRankIndex(nextRankIndex);
      setWantPhaseIndex(0);
      setWantLoopCount(0);
      setWantCheckPhase(null);
      updateSession({ selectedWant: nextWant, currentStep: 8 });
    } else if (answer === "是") {
      // 用完了排好的，让用户重新选
      setRankedWants([]);
      setCurrentWantRankIndex(0);
      setWantPhaseIndex(0);
      setWantCheckPhase(null);
      updateSession({ selectedWant: null, currentStep: 7, aiMessage: "还有其他的想要，重新选择" });
    } else {
      setWantCheckPhase(null);
      saveSessionToHistory({ ...session, status: "completed" });
      if (remainingEmotions.length > 0) {
        setNextEmotionOffer(remainingEmotions[0]);
        setRemainingEmotions(remainingEmotions.slice(1));
      } else {
        updateSession({ currentStep: 9, aiMessage: null });
      }
    }
  }

  // ---- 步骤9（可选记录） ----
  function handleStep9Submit() {
    setCompletionMessage("这次释放完成了。");
    setCompleted(true);
  }

  function handleStartNextEmotion(emotion: IdentifiedEmotion, remaining: IdentifiedEmotion[]) {
    setNextEmotionOffer(null);
    setRemainingEmotions(remaining);
    setSession({
      ...createInitialSession(),
      identifiedEmotion: emotion,
      aiMessage: `接下来我们来看看「${emotion.level}」。`,
      currentStep: 2,
    });
    setTextInput("");
    setSliderValue([5]);
    setWantPhaseIndex(0);
    setWantLoopCount(0);
    setWantCheckPhase(null);
    setRankedWants([]);
    setCurrentWantRankIndex(0);
    setAnimKey((k) => k + 1);
  }

  const step = session.currentStep;
  const wantPhase = WANT_PHASES[wantPhaseIndex];
  const emotionLevel = session.identifiedEmotion?.level ?? "感受";
  const emotionLabel = session.identifiedEmotion?.words.find((w) => w.trim()) || emotionLevel;
  const wantLabel = session.selectedWant?.label ?? "这个想要";
  const nextRankedWant = rankedWants[currentWantRankIndex + 1];

  // ---- 下一个情绪提示页 ----
  if (nextEmotionOffer) {
    const allOffered = [nextEmotionOffer, ...remainingEmotions];
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full space-y-6 step-animate">
          <div className="text-3xl text-muted-foreground text-center">✦</div>
          <h2 className="text-xl font-medium text-center">这份感受处理得差不多了。</h2>
          <p className="text-sm text-muted-foreground text-center">
            你刚才还提到了{allOffered.length > 1 ? "以下感受" : "另一份感受"}，要继续释放哪一个？
          </p>
          <div className="space-y-3">
            {allOffered.map((emotion) => {
              const others = allOffered.filter((e) => e.level !== emotion.level);
              return (
                <button
                  key={emotion.level}
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
          <h2 className="text-xl font-medium">{completionMessage}</h2>
          <p className="text-muted-foreground text-sm">释放完成</p>
          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={() => {
              setSession(createInitialSession());
              setCompleted(false);
              setTextInput("");
              setSliderValue([5]);
              setWantPhaseIndex(0);
              setWantLoopCount(0);
              setWantCheckPhase(null);
              setRankedWants([]);
              setCurrentWantRankIndex(0);
              setEmotionSelection(null);
              setRemainingEmotions([]);
              setNextEmotionOffer(null);
              setExitReason("");
              setExitNotes("");
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
          <span>{exitFlow ? "退出" : (STEP_STAGE[step] ?? "释放")}</span>
          <div className="flex items-center gap-3">
            <span>{Math.min(step, TOTAL_STEPS)} / {TOTAL_STEPS}</span>
            {!exitFlow && (
              <button
                onClick={() => { setExitFlow("reason"); setAnimKey((k) => k + 1); }}
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                退出
              </button>
            )}
          </div>
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

          {/* 退出流程 */}
          {exitFlow === "reason" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-medium">退出前，说说原因</h2>
                <p className="text-sm text-muted-foreground mt-1">只是留个记录，不是评判。</p>
              </div>
              <div className="space-y-3">
                {["感到抗拒，不想继续", "觉得差不多了，不需要走完", "其他原因"].map((reason) => (
                  <button
                    key={reason}
                    onClick={() => handleExitReason(reason)}
                    className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 transition-all duration-200 text-sm"
                  >
                    {reason}
                  </button>
                ))}
              </div>
              <Button variant="ghost" className="w-full" onClick={() => { setExitFlow(null); setAnimKey((k) => k + 1); }}>
                取消，继续释放
              </Button>
            </div>
          )}

          {exitFlow === "notes" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-medium">对这次有什么想说的？</h2>
                <p className="text-sm text-muted-foreground mt-1">感受的变化、想法、对自己的认识……（可跳过）</p>
              </div>
              {exitReason && (
                <p className="text-xs text-muted-foreground px-1">原因：{exitReason}</p>
              )}
              <Textarea
                placeholder="写下此刻的感受……"
                value={exitNotes}
                onChange={(e) => setExitNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <Button className="w-full" onClick={handleExitConfirm}>保存并退出</Button>
            </div>
          )}

          {/* 正常步骤内容（退出流程时隐藏） */}
          {!exitFlow && <>

          {/* 已识别情绪标签 */}
          {session.identifiedEmotion && step > 1 && (
            <div className="space-y-2">
              <span className="inline-block text-sm font-semibold px-3 py-1 rounded-full bg-primary/12 text-primary border border-primary/25">
                {session.identifiedEmotion.level}
                {session.identifiedEmotion.words[0] && `：${session.identifiedEmotion.words[0]}`}
              </span>
              {session.identifiedEmotion.words.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {session.identifiedEmotion.words.slice(1).map((w) => (
                    <span key={w} className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-foreground/70">{w}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* AI 过渡提示 */}
          {session.aiMessage && (
            <p className="text-base text-foreground/80 leading-relaxed">{session.aiMessage}</p>
          )}

          {/* 步骤1：输入 */}
          {step === 1 && !emotionSelection && (
            <StepOpenText
              question="此刻你有什么感受？"
              subtext="尝试描述内心的感受——比如紧张、委屈、疲惫、担心……而不只是发生了什么事。"
              placeholder="可以从身体感觉开始，或者最近让你难受的那件事……"
              value={textInput}
              onChange={setTextInput}
              onSubmit={handleStep1Submit}
              loading={loading}
            />
          )}

          {/* 步骤1：检测到多种情绪，让用户选择 */}
          {step === 1 && emotionSelection && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-medium leading-snug">你想先释放哪个？</h2>
                <p className="text-sm text-muted-foreground mt-1">点击你此刻最想处理的那份感受</p>
              </div>
              <div className="space-y-3">
                {emotionSelection.map((emotion) => (
                  <button
                    key={emotion.level}
                    onClick={() => handleSelectEmotionToRelease(emotion)}
                    className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 transition-all duration-200 space-y-1"
                  >
                    <p className="font-semibold text-sm text-primary">
                      {emotion.level}{emotion.words[0] ? `：${emotion.words[0]}` : ""}
                    </p>
                    {emotion.words.length > 1 && (
                      <p className="text-xs text-muted-foreground">{emotion.words.slice(1).join("、")}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 步骤2 */}
          {step === 2 && (
            <StepYesNo
              question={`你能允许这份「${emotionLabel}」就这样存在吗？`}
              subtext={`提示：我们释放的是内心的「${emotionLabel}」这个感受，而不是引发它的那件事或那个情况。`}
              onAnswer={handleYesNo}
            />
          )}

          {/* 步骤3 */}
          {step === 3 && (
            <StepYesNo
              question={`你能让这份「${emotionLabel}」离开吗？`}
              subtext="Could you let it go?"
              onAnswer={handleYesNo}
            />
          )}

          {/* 步骤4 */}
          {step === 4 && (
            <StepYesNo
              question={`你愿意让这份「${emotionLabel}」离开吗？`}
              subtext="Would you?"
              onAnswer={handleYesNo}
            />
          )}

          {/* 步骤5 */}
          {step === 5 && (
            <StepWhen
              note={`即使外部情况没变，内心的「${emotionLabel}」可以现在就松开。`}
              onAnswer={handleChoice2}
            />
          )}

          {/* 步骤6：强度评分 */}
          {step === 6 && !askLoopAgain && (
            <div className="space-y-8">
              <div className="space-y-2">
                <h2 className="text-xl font-medium">此刻这份「{emotionLabel}」的强度是？</h2>
                <p className="text-sm text-muted-foreground">0 = 完全没有，10 = 非常强烈</p>
              </div>
              <div className="space-y-4">
                <Slider min={0} max={10} step={1} value={sliderValue} onValueChange={setSliderValue} className="w-full" />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span className="text-foreground font-semibold text-lg">{sliderValue[0]}</span>
                  <span>10</span>
                </div>
              </div>
              {session.loopCount >= LOOP_WARNING_THRESHOLD && (
                <p className="text-xs text-muted-foreground">这个议题可能比较深层，你也可以先停下来，让自己休息一下。</p>
              )}
              <Button className="w-full" onClick={handleScoreSubmit}>继续</Button>
            </div>
          )}

          {/* 步骤6：再来一轮？ */}
          {step === 6 && askLoopAgain && (
            <div className="space-y-6">
              <h2 className="text-xl font-medium">还有一些残留，要再释放一轮吗？</h2>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => handleLoopAgain(true)}>是的</Button>
                <Button className="flex-1" variant="outline" onClick={() => handleLoopAgain(false)}>不了，继续</Button>
              </div>
            </div>
          )}

          {/* 步骤7：多选想要 */}
          {step === 7 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-xl font-medium">在这份「{emotionLabel}」背后，你最想要的是……</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  情绪背后往往藏着某种渴望——比如想被认可、想有安全感、想掌控局面。释放这个渴望本身，情绪往往会自然松动。
                </p>
                <p className="text-xs text-muted-foreground/70">
                  可以多选，按强烈程度依次点击（第1个最强烈）
                </p>
              </div>
              {loading && <p className="text-sm text-muted-foreground">正在感应……</p>}
              {session.generatedWants.map((w) => {
                const rankIdx = rankedWants.findIndex((r) => r.label === w.label);
                const rank = rankIdx >= 0 ? rankIdx + 1 : null;
                return (
                  <button
                    key={w.label}
                    onClick={() => handleToggleWant(w)}
                    className={[
                      "w-full text-left p-4 rounded-xl border transition-all duration-200 space-y-1.5 relative",
                      rank !== null
                        ? "border-primary/50 bg-primary/6"
                        : "border-border hover:border-primary/30 hover:bg-muted/50",
                    ].join(" ")}
                  >
                    {rank !== null && (
                      <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center">
                        {rank}
                      </span>
                    )}
                    <p className="font-medium text-sm pr-7">{w.label}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{w.description}</p>
                  </button>
                );
              })}
              {rankedWants.length > 0 && (
                <Button className="w-full" onClick={handleConfirmWants}>
                  开始释放{rankedWants.length > 1 ? `（共 ${rankedWants.length} 个）` : ""}
                </Button>
              )}
            </div>
          )}

          {/* 步骤8：想要的子阶段 */}
          {step === 8 && wantCheckPhase === null && (
            <div className="space-y-5">
              {session.selectedWant && (
                <p className="text-sm text-muted-foreground leading-relaxed">{session.selectedWant.description}</p>
              )}
              {wantPhase === "allow" && (
                <StepYesNo
                  question={`你能允许「${wantLabel}」就这样存在吗？`}
                  onAnswer={handleWantPhaseAnswer}
                />
              )}
              {wantPhase === "could" && (
                <StepYesNo
                  question={`你能让「${wantLabel}」离开吗？`}
                  subtext="Could you let it go?"
                  onAnswer={handleWantPhaseAnswer}
                />
              )}
              {wantPhase === "would" && (
                <StepYesNo
                  question={`你愿意放下「${wantLabel}」吗？`}
                  subtext="（记住：放下执着不等于放弃拥有）"
                  onAnswer={handleWantPhaseAnswer}
                />
              )}
              {wantPhase === "when" && <StepWhen onAnswer={handleWantWhen} />}
            </div>
          )}

          {/* 步骤8：检查是否还有残留 */}
          {step === 8 && wantCheckPhase === "same" && (
            <StepYesNo
              question={`对「${wantLabel}」的执着，还有残留吗？`}
              subtext="如果内心仍有一丝抓紧的感觉，选「是」再来一轮；感觉轻了就选「否」。"
              onAnswer={handleWantCheckSame}
            />
          )}

          {/* 步骤8：检查下一个想要 */}
          {step === 8 && wantCheckPhase === "others" && (
            nextRankedWant ? (
              <StepYesNo
                question={`接下来释放第 ${currentWantRankIndex + 2} 个渴望：「${nextRankedWant.label}」？`}
                onAnswer={handleWantCheckOthers}
              />
            ) : (
              <StepYesNo
                question="还有其他深层渴望想继续释放吗？"
                subtext="选「是」回到列表重新选择，选「否」完成这部分。"
                onAnswer={handleWantCheckOthers}
              />
            )
          )}

          {/* 步骤9：可选记录 */}
          {step === 9 && (
            <div className="space-y-4">
              <h2 className="text-xl font-medium leading-snug">有什么想记录的吗？</h2>
              <p className="text-sm text-muted-foreground">感受的变化、对自己的认识……可以不写，直接完成。</p>
              <Textarea
                placeholder="此刻的感受、想法……（可选）"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <Button className="w-full" onClick={handleStep9Submit}>完成</Button>
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
      <h2 className="text-xl font-medium leading-snug">{question}</h2>
      {subtext && <p className="text-sm text-muted-foreground">{subtext}</p>}
      <Textarea
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="resize-none"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(); }
        }}
      />
      <p className="text-xs text-muted-foreground">Enter 提交 · Shift+Enter 换行</p>
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
      <h2 className="text-xl font-medium leading-snug">{question}</h2>
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
      <h2 className="text-xl font-medium">什么时候？</h2>
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
