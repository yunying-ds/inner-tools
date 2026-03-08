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
import { useLang, interp } from "@/lib/i18n";

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

function getProgress(step: number): number {
  return Math.round((Math.min(step, TOTAL_STEPS) / TOTAL_STEPS) * 100);
}

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
  const { t, lang } = useLang();
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
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const [isManualEmotion, setIsManualEmotion] = useState(false);

  const sep = lang === "zh" ? "、" : ", ";

  function emotionDisplay(emotion: IdentifiedEmotion): { level: string; words: string[] } {
    if (lang === "en") {
      return {
        level: emotion.levelEn ?? emotion.level,
        words: emotion.wordsEn ?? emotion.words,
      };
    }
    return { level: emotion.level, words: emotion.wordsCn ?? emotion.words };
  }

  function saveSessionToHistory(s: SessionState) {
    const emotionForRecord = s.identifiedEmotion;
    const ed = emotionForRecord ? emotionDisplay(emotionForRecord) : null;
    const summary = ed
      ? interp(t.explore.processedSummary, { level: ed.level, words: ed.words.join(sep) })
      : t.explore.completedSummary;
    const saved: SavedSession = {
      id: s.id,
      startedAt: s.startedAt,
      completedAt: Date.now(),
      status: s.status,
      identifiedEmotion: emotionForRecord,
      summary,
    };
    const existing = JSON.parse(localStorage.getItem("release_history") || "[]");
    localStorage.setItem("release_history", JSON.stringify([saved, ...existing]));
  }

  function captureEntry(emotion: IdentifiedEmotion | null, wants: WantOption[]) {
    if (!emotion) return;
    setSummaryEntries((prev) => [...prev, { emotion, wants }]);
  }

  const updateSession = useCallback((patch: Partial<SessionState>) => {
    setSession((prev) => ({ ...prev, ...patch }));
    setAnimKey((k) => k + 1);
  }, []);

  const FALLBACK_WANTS: WantOption[] = [
    { label: t.explore.fallbackWantControl, description: t.explore.fallbackWantControlDesc },
    { label: t.explore.fallbackWantLove, description: t.explore.fallbackWantLoveDesc },
    { label: t.explore.fallbackWantSafety, description: t.explore.fallbackWantSafetyDesc },
  ];

  // 步骤7进入时自动加载想要选项
  const wantsLoadedRef = useRef(false);
  useEffect(() => {
    if (session.currentStep === 7 && session.generatedWants.length === 0 && !wantsLoadedRef.current) {
      wantsLoadedRef.current = true;
      loadWantOptions();
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
  async function handleStep1Submit(inputOverride?: string) {
    const input = inputOverride ?? textInput.trim();
    if (!input || loading) return;
    setLoading(true);
    try {
      const typeRes = await fetch("/api/release/identify-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInput: input, lang }),
      });
      if (typeRes.ok) {
        const typeData = await typeRes.json();
        setOriginalInput((prev) => prev || input);
        setLastTextInput(input);
        if (typeData.inputType === "body") {
          setBodyGuidance(typeData.label || input);
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
        body: JSON.stringify({ userInput: input, lang }),
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setApiError(null);
      const historyEntry = { stepId: 1, question: t.explore.step1HistoryQ, answer: input, timestamp: Date.now() };
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
      setApiError(t.explore.apiError);
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
        body: JSON.stringify({ userInput: input, lang }),
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setApiError(null);
      const historyEntry = { stepId: 1, question: t.explore.step1HistoryQ, answer: input, timestamp: Date.now() };
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
      setApiError(t.explore.apiErrorRetry);
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
        body: JSON.stringify({ userInput: correctionInput, lang }),
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
      // silent fail
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
      aiReply: interp(t.explore.selfInputAiReply, { word: selfInputWord.trim() }),
    };
    setSelfInputMode(false);
    setSelfInputWord("");
    setSelfInputLevel(null);
    setIsManualEmotion(true);
    updateSession({
      identifiedEmotion: emotion,
      aiMessage: emotion.aiReply,
      history: [...session.history, { stepId: 1, question: t.explore.selfInputHistoryQ, answer: `${level.name}：${selfInputWord.trim()}`, timestamp: Date.now() }],
      currentStep: 2,
    });
  }

  function handleManualEmotionSelect(emotion: IdentifiedEmotion) {
    setManualEmotionPicker(false);
    setIsManualEmotion(true);
    updateSession({
      identifiedEmotion: emotion,
      aiMessage: emotion.aiReply,
      history: [...session.history, { stepId: 1, question: t.explore.manualPickHistoryQ, answer: `${emotion.level}：${emotion.words.join(sep)}`, timestamp: Date.now() }],
      currentStep: 2,
    });
  }

  // ---- 返回 ----
  function handleBack() {
    if (step === 1) {
      if (pendingEmotion || emotionSelection || bodyGuidance || topicMode || selfInputMode || manualEmotionPicker) {
        setPendingEmotion(null);
        setEmotionSelection(null);
        setBodyGuidance(null);
        setTopicMode(null);
        setSelfInputMode(false);
        setManualEmotionPicker(false);
        setCorrectionMode(null);
        setTextInput(lastTextInput);
        setAnimKey((k) => k + 1);
      } else {
        onBack ? onBack() : router.back();
      }
    } else {
      updateSession({ currentStep: Math.max(1, step - 1) });
    }
  }

  // ---- 退出 ----
  function handleExit() {
    captureEntry(session.identifiedEmotion, session.generatedWants);
    const emotionForRecord = session.identifiedEmotion ?? summaryEntries[summaryEntries.length - 1]?.emotion ?? null;
    const ed = emotionForRecord ? emotionDisplay(emotionForRecord) : null;
    const summary = ed
      ? interp(t.explore.abandonedSummaryWords, { words: ed.words.join(sep) })
      : t.explore.abandonedSummaryUnknown;
    const saved: SavedSession = {
      id: session.id,
      startedAt: session.startedAt,
      completedAt: Date.now(),
      status: "abandoned",
      identifiedEmotion: emotionForRecord,
      summary,
    };
    const existing = JSON.parse(localStorage.getItem("release_history") || "[]");
    localStorage.setItem("release_history", JSON.stringify([saved, ...existing]));
    router.back();
  }

  // ---- 步骤2-4 yes/no ----
  function handleYesNo(answer: string) {
    const step = session.currentStep;
    const ed = session.identifiedEmotion ? emotionDisplay(session.identifiedEmotion) : null;
    const emotionLabel = ed?.words.find((w) => w.trim()) || ed?.level || t.explore.emotionFallback;
    const questions: Record<number, string> = {
      2: interp(t.explore.step2Question, { emotion: emotionLabel }),
      3: interp(t.explore.step3Question, { emotion: emotionLabel }),
      4: interp(t.explore.step4Question, { emotion: emotionLabel }),
    };
    const history = [...session.history, { stepId: step, question: questions[step] ?? "", answer, timestamp: Date.now() }];
    updateSession({ history, aiMessage: null, currentStep: step + 1 });
  }

  // ---- 步骤5 ----
  function handleChoice2(answer: string) {
    const history = [...session.history, { stepId: 5, question: t.explore.step5When, answer, timestamp: Date.now() }];
    updateSession({ history, aiMessage: null, currentStep: 6 });
  }

  // ---- 步骤6 ----
  function handleStep6Answer(hasMore: boolean) {
    const answer = hasMore ? t.explore.step6More : t.explore.step6Done;
    const newHistory = [...session.history, { stepId: 6, question: interp(t.explore.step6Heading, { emotion: emotionLabel }), answer, timestamp: Date.now() }];
    if (hasMore) {
      const newLoopCount = session.loopCount + 1;
      if (newLoopCount >= MAX_LOOPS) {
        updateSession({ loopCount: newLoopCount, history: newHistory, aiMessage: t.explore.feelingPersistsMsg, currentStep: 7 });
      } else {
        updateSession({ loopCount: newLoopCount, history: newHistory, aiMessage: t.explore.someMoreMsg, currentStep: 3 });
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
          lang,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const wants = Array.isArray(data.wants) && data.wants.length > 0 ? data.wants : FALLBACK_WANTS;
      updateSession({ generatedWants: wants });
    } catch (e) {
      console.error(e);
      updateSession({ generatedWants: FALLBACK_WANTS });
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
      question: t.explore.step7Heading,
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
      setCompletionMessage(t.explore.thisReleaseDoneMsg);
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
          currentEmotion: session.identifiedEmotion?.level ?? t.explore.emotionFallback,
          lang,
        }),
      });
      const data = await res.json();
      setStep9Feedback(data);
    } catch {
      setStep9Feedback({ type: "release_signal", feedback: lang === "en" ? "Thank you for sharing. This release is complete." : "感谢你的记录，这次释放完成了。", hasNewEmotion: false });
    } finally {
      setLoading(false);
    }
  }

  function handleStep9Continue() {
    const input = textInput;
    setStep9Feedback(null);
    setSession({ ...createInitialSession(), aiMessage: t.explore.newFeelingMsg });
    setEmotionSelection(null);
    setRemainingEmotions([]);
    setNextEmotionOffer(null);
    setTextInput(input);
    setAnimKey((k) => k + 1);
  }

  function handleStep9Complete() {
    setCompletionMessage(t.explore.thisReleaseDoneMsg);
    setCompleted(true);
  }

  function handleStartNextEmotion(emotion: IdentifiedEmotion, remaining: IdentifiedEmotion[]) {
    wantsLoadedRef.current = false;
    setIsManualEmotion(false);
    setBodyGuidance(null);
    setTopicMode(null);
    setNextEmotionOffer(null);
    setRemainingEmotions(remaining);
    const ed = emotionDisplay(emotion);
    setSession({
      ...createInitialSession(),
      identifiedEmotion: emotion,
      aiMessage: interp(t.explore.nextEmotionMsg, { level: ed.level }),
      currentStep: 2,
    });
    setTextInput("");
    setAnimKey((k) => k + 1);
  }

  const step = session.currentStep;
  const currentEmotionDisplay = session.identifiedEmotion ? emotionDisplay(session.identifiedEmotion) : null;
  const emotionLevel = currentEmotionDisplay?.level ?? t.explore.emotionFallback;
  const emotionLabel = currentEmotionDisplay?.words.find((w) => w.trim()) || emotionLevel;

  // ---- 下一个情绪提示页 ----
  if (nextEmotionOffer) {
    const allOffered = [nextEmotionOffer, ...remainingEmotions];
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="max-w-md w-full space-y-6 step-animate">
          <div className="text-3xl text-muted-foreground text-center">✦</div>
          <h2 className="text-lg font-medium text-center">{t.explore.nextEmotionHeading}</h2>
          <p className="text-sm text-muted-foreground text-center">
            {allOffered.length > 1 ? t.explore.nextEmotionSubtextMulti : t.explore.nextEmotionSubtextOne}
          </p>
          <div className="space-y-3">
            {allOffered.map((emotion) => {
              const others = allOffered.filter((e) => e !== emotion);
              const ed = emotionDisplay(emotion);
              return (
                <button
                  key={emotion.words[0] ?? emotion.level}
                  onClick={() => handleStartNextEmotion(emotion, others)}
                  className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 transition-all duration-200"
                >
                  <p className="font-semibold text-sm text-primary">
                    {ed.level}{ed.words[0] ? `：${ed.words[0]}` : ""}
                  </p>
                  {ed.words.length > 1 && (
                    <p className="text-xs text-muted-foreground mt-0.5">{ed.words.slice(1).join(sep)}</p>
                  )}
                </button>
              );
            })}
          </div>
          <Button variant="outline" className="w-full" onClick={() => {
            setNextEmotionOffer(null);
            setRemainingEmotions([]);
            setCompletionMessage(t.explore.todayDoneMsg);
            setCompleted(true);
          }}>{t.explore.endSession}</Button>
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
              <p className="text-xs text-muted-foreground uppercase tracking-widest">{t.explore.completionSummaryLabel}</p>
              {summaryEntries.map((entry, i) => {
                const ed = emotionDisplay(entry.emotion);
                return (
                  <div key={i} className="border border-border rounded-xl px-4 py-3 space-y-1.5">
                    <p className="text-sm font-medium text-foreground">
                      {ed.level}
                      {ed.words.length > 0 && (
                        <span className="font-normal text-muted-foreground"> · {ed.words.join(sep)}</span>
                      )}
                    </p>
                    {entry.wants.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t.explore.wantsBehind}{entry.wants.map((w) => w.label).join(sep)}
                      </p>
                    )}
                  </div>
                );
              })}
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
              {t.explore.startNew}
            </Button>
            <Button variant="outline" onClick={() => router.push("/release/history")}>
              {t.explore.viewHistory}
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
          <button onClick={handleBack} className="hover:text-foreground transition-colors">{t.common.back}</button>
          <span>{Math.min(step, TOTAL_STEPS)} / {TOTAL_STEPS}</span>
          <button
            onClick={() => setExitConfirmOpen(true)}
            className="text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          >
            {t.common.exit}
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

          {<>

          {/* 已识别情绪标签 */}
          {session.identifiedEmotion && step > 1 && (
            <div className="space-y-2">
              {originalInput && originalInput !== emotionLabel && (
                <p className="text-xs text-muted-foreground/50">{lang === "zh" ? "来自：" : "From: "}{originalInput}</p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-block text-sm font-semibold px-3 py-1 rounded-full bg-primary/12 text-primary border border-primary/25">
                  {currentEmotionDisplay!.level}
                  {currentEmotionDisplay!.words[0] && `：${currentEmotionDisplay!.words[0]}`}
                  {lang === "zh" && session.identifiedEmotion.wordsEn?.[0] && (
                    <span className="font-normal opacity-55 ml-1">({session.identifiedEmotion.wordsEn[0]})</span>
                  )}
                </span>
                {!correctionMode && (
                  <button
                    onClick={() => setCorrectionMode("input")}
                    className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                  >
                    {t.explore.notAccurate}
                  </button>
                )}
              </div>
              {currentEmotionDisplay!.words.length > 1 && !correctionMode && (
                <div className="flex gap-2 flex-wrap">
                  {currentEmotionDisplay!.words.slice(1).map((w, i) => (
                    <span key={w} className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-foreground/70">
                      {w}
                      {lang === "zh" && session.identifiedEmotion!.wordsEn?.[i + 1] && (
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
                    placeholder={t.explore.reidentifyPlaceholder}
                    rows={2}
                    value={correctionInput}
                    onChange={(e) => setCorrectionInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCorrectionSubmit(); } }}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleCorrectionSubmit} disabled={!correctionInput.trim() || loading}>
                      {loading ? t.common.identifying : t.explore.reidentifyBtn}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setCorrectionMode("picker")}>
                      {t.explore.pickSelf}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setCorrectionMode(null); setCorrectionInput(""); }}>
                      {lang === "zh" ? "取消" : "Cancel"}
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
                  {t.explore.continueEdit}
                </button>
                <p className="text-sm text-muted-foreground mb-3">{session.aiMessage}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {(() => {
                    const ed = emotionDisplay(pendingEmotion);
                    return (
                      <>
                        <span className="inline-block text-sm font-semibold px-3 py-1 rounded-full bg-primary/12 text-primary border border-primary/25">
                          {ed.level}
                          {ed.words[0] && `：${ed.words[0]}`}
                          {lang === "zh" && pendingEmotion.wordsEn?.[0] && (
                            <span className="font-normal opacity-55 ml-1">({pendingEmotion.wordsEn[0]})</span>
                          )}
                        </span>
                        {ed.words.slice(1).map((w, i) => (
                          <span key={w} className="text-xs px-2.5 py-0.5 rounded-full bg-muted text-foreground/70">
                            {w}
                            {lang === "zh" && pendingEmotion.wordsEn?.[i + 1] && (
                              <span className="opacity-55 ml-1">({pendingEmotion.wordsEn[i + 1]})</span>
                            )}
                          </span>
                        ))}
                      </>
                    );
                  })()}
                </div>
              </div>
              <Button className="w-full" onClick={handleConfirmEmotion}>
                {t.explore.startRelease}
              </Button>
              <div className="flex justify-center gap-4">
                <button onClick={() => setCorrectionMode("input")} className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors">{t.explore.redescribe}</button>
                <span className="text-muted-foreground/30 text-sm">·</span>
                <button onClick={() => setCorrectionMode("picker")} className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors">{t.explore.pickFromTable}</button>
                <span className="text-muted-foreground/30 text-sm">·</span>
                <button onClick={() => setCorrectionMode("self")} className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors">{t.explore.directEnter}</button>
              </div>
            </div>
          )}

          {/* 步骤1：确认屏的纠正模式 */}
          {step === 1 && pendingEmotion && correctionMode === "input" && (
            <div className="space-y-3">
              <button onClick={() => setCorrectionMode(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">{t.common.back}</button>
              <textarea
                className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder={t.explore.reidentifyPlaceholder}
                rows={2}
                value={correctionInput}
                onChange={(e) => setCorrectionInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleCorrectionSubmit(); } }}
              />
              <Button size="sm" onClick={handleCorrectionSubmit} disabled={!correctionInput.trim() || loading}>
                {loading ? t.common.identifying : t.explore.reidentifyBtn}
              </Button>
            </div>
          )}
          {step === 1 && pendingEmotion && correctionMode === "picker" && (
            <EmotionPicker onSelect={handleCorrectionPick} onCancel={() => setCorrectionMode(null)} />
          )}
          {step === 1 && pendingEmotion && correctionMode === "self" && (
            <div className="space-y-4">
              <button onClick={() => setCorrectionMode(null)} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">{t.common.back}</button>
              <input
                type="text"
                className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder={t.explore.selfWord}
                value={selfInputWord}
                onChange={(e) => setSelfInputWord(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                {EMOTION_LEVELS.map((l) => (
                  <button key={l.index} onClick={() => setSelfInputLevel(l.index)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-150 ${selfInputLevel === l.index ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>
                    {lang === "en" ? l.nameEn : l.name}
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={() => {
                if (!selfInputWord.trim() || selfInputLevel === null) return;
                const level = EMOTION_LEVELS.find((l) => l.index === selfInputLevel)!;
                handleCorrectionPick({ words: [selfInputWord.trim()], wordsCn: [selfInputWord.trim()], level: level.name as IdentifiedEmotion["level"], levelEn: level.nameEn, levelIndex: level.index as IdentifiedEmotion["levelIndex"], aiReply: "" });
                setSelfInputWord(""); setSelfInputLevel(null);
              }} disabled={!selfInputWord.trim() || selfInputLevel === null}>{lang === "zh" ? "确认" : "Confirm"}</Button>
            </div>
          )}

          {/* 步骤1：手动选择情绪 */}
          {step === 1 && manualEmotionPicker && (
            <EmotionPicker
              onSelect={handleManualEmotionSelect}
              onCancel={() => setManualEmotionPicker(false)}
            />
          )}

          {/* 步骤1：自行输入情绪 */}
          {step === 1 && selfInputMode && (
            <div className="space-y-4">
              <div>
                <button
                  onClick={() => { setSelfInputMode(false); setSelfInputWord(""); setSelfInputLevel(null); }}
                  className="text-sm text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1"
                >
                  {t.common.back}
                </button>
                <h2 className="text-lg font-medium leading-snug">{t.explore.selfHeading}</h2>
              </div>
              <input
                type="text"
                className="w-full text-sm rounded-lg border border-border bg-background px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary/40"
                placeholder={t.explore.selfPlaceholder}
                value={selfInputWord}
                onChange={(e) => setSelfInputWord(e.target.value)}
              />
              <div>
                <p className="text-sm text-muted-foreground mb-2">{t.explore.selfLevelLabel}</p>
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
                      {lang === "en" ? l.nameEn : l.name}
                    </button>
                  ))}
                </div>
              </div>
              <Button
                className="w-full"
                onClick={handleSelfInputConfirm}
                disabled={!selfInputWord.trim() || selfInputLevel === null}
              >
                {t.explore.selfStartBtn}
              </Button>
            </div>
          )}

          {/* 步骤1：事件/话题引导 */}
          {step === 1 && topicMode && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">{topicMode.aiReply}</p>
              <Textarea
                placeholder={t.explore.topicPlaceholder}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={3}
                className="resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleStep1SubmitWithInput(); }
                }}
              />
              <Button className="w-full" onClick={handleStep1SubmitWithInput} disabled={!textInput.trim() || loading}>
                {loading ? t.explore.loadingBtn : t.explore.continueBtn}
              </Button>
              <button
                onClick={() => { setTopicMode(null); setTextInput(lastTextInput); }}
                className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground text-center py-1 transition-colors"
              >
                {t.explore.backToInput}
              </button>
            </div>
          )}

          {/* 步骤1：身体感受引导 */}
          {step === 1 && bodyGuidance && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t.explore.bodyGuidanceText}
              </p>
              <h2 className="text-lg font-medium leading-snug">
                {interp(t.explore.bodyGuidanceHeading, { body: bodyGuidance })}
              </h2>
              <Textarea
                placeholder={t.explore.bodyGuidancePlaceholder}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                rows={3}
                className="resize-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleStep1SubmitWithInput(); }
                }}
              />
              <Button className="w-full" onClick={handleStep1SubmitWithInput} disabled={!textInput.trim() || loading}>
                {loading ? t.explore.loadingBtn : t.explore.continueBtn}
              </Button>
              <button
                onClick={() => { setBodyGuidance(null); setTextInput(bodyGuidance); }}
                className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground text-center py-1 transition-colors"
              >
                {t.explore.backToInput}
              </button>
            </div>
          )}

          {/* 步骤1：输入 */}
          {step === 1 && !bodyGuidance && !topicMode && !emotionSelection && !manualEmotionPicker && !selfInputMode && !pendingEmotion && (
            <div className="space-y-3">
              <StepOpenText
                question={t.explore.step1Question}
                placeholder={t.explore.step1Placeholder}
                value={textInput}
                onChange={setTextInput}
                onSubmit={handleStep1Submit}
                loading={loading}
                loadingLabel={t.explore.loadingBtn}
                continueLabel={t.explore.continueBtn}
              />
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setManualEmotionPicker(true)}
                  className="text-sm text-muted-foreground/60 hover:text-muted-foreground py-1 transition-colors"
                >
                  {t.explore.fromEmotionTable}
                </button>
                <span className="text-muted-foreground/30 text-sm">·</span>
                <button
                  onClick={() => setSelfInputMode(true)}
                  className="text-sm text-muted-foreground/60 hover:text-muted-foreground py-1 transition-colors"
                >
                  {t.explore.directInput}
                </button>
              </div>
            </div>
          )}

          {/* 步骤1：检测到多种情绪，让用户选择 */}
          {step === 1 && emotionSelection && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-medium leading-snug">{t.explore.selectionHeading}</h2>
                <p className="text-sm text-muted-foreground mt-1">{t.explore.selectionSubtext}</p>
              </div>
              <div className="space-y-3">
                {emotionSelection.map((emotion) => {
                  const ed = emotionDisplay(emotion);
                  return (
                    <button
                      key={emotion.words[0] ?? emotion.level}
                      onClick={() => handleSelectEmotionToRelease(emotion)}
                      className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 transition-all duration-200 space-y-1"
                    >
                      <p className="text-xs text-muted-foreground/70 mb-0.5">
                        {ed.level}{lang === "zh" && emotion.levelEn && <span className="ml-1">({emotion.levelEn})</span>}
                      </p>
                      <p className="font-semibold text-sm text-primary">
                        {ed.words[0]}
                        {lang === "zh" && emotion.wordsEn?.[0] && <span className="font-normal opacity-55 ml-1">({emotion.wordsEn[0]})</span>}
                      </p>
                      {ed.words.length > 1 && (
                        <p className="text-xs text-muted-foreground">
                          {ed.words.slice(1).map((w, i) => (
                            <span key={i}>{i > 0 && sep}{w}{lang === "zh" && emotion.wordsEn?.[i + 1] && <span className="opacity-55 ml-0.5">({emotion.wordsEn[i + 1]})</span>}</span>
                          ))}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-center gap-4 pt-1">
                <button
                  onClick={() => { setEmotionSelection(null); setTextInput(lastTextInput); }}
                  className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  {t.explore.redescribe}
                </button>
                <span className="text-muted-foreground/30 text-sm">·</span>
                <button
                  onClick={() => { setEmotionSelection(null); setManualEmotionPicker(true); }}
                  className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  {t.explore.pickFromTable}
                </button>
                <span className="text-muted-foreground/30 text-sm">·</span>
                <button
                  onClick={() => { setEmotionSelection(null); setSelfInputMode(true); }}
                  className="text-sm text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                >
                  {t.explore.directEnter}
                </button>
              </div>
            </div>
          )}

          {/* 步骤2 */}
          {step === 2 && (
            <div className="space-y-4">
              <StepYesNo
                question={interp(t.explore.step2Question, { emotion: emotionLabel })}
                subtext={t.explore.step2Subtext}
                onAnswer={handleYesNo}
                yesLabel={t.explore.can}
                noLabel={t.explore.cannot}
              />
              <button
                onClick={() => updateSession({ currentStep: 7 })}
                className="w-full text-xs text-muted-foreground/40 hover:text-muted-foreground/60 text-center py-1 transition-colors"
              >
                {t.explore.skipToWants}
              </button>
            </div>
          )}

          {/* 步骤3 */}
          {step === 3 && (
            <div className="space-y-4">
              <StepYesNo
                question={interp(t.explore.step3Question, { emotion: emotionLabel })}
                subtext={t.explore.step3Subtext}
                onAnswer={handleYesNo}
                yesLabel={t.explore.can}
                noLabel={t.explore.cannot}
              />
              <button
                onClick={() => updateSession({ currentStep: 7 })}
                className="w-full text-xs text-muted-foreground/40 hover:text-muted-foreground/60 text-center py-1 transition-colors"
              >
                {t.explore.skipToWants}
              </button>
            </div>
          )}

          {/* 步骤4 */}
          {step === 4 && (
            <div className="space-y-4">
              <StepYesNo
                question={interp(t.explore.step4Question, { emotion: emotionLabel })}
                subtext={t.explore.step4Subtext}
                onAnswer={handleYesNo}
                yesLabel={t.common.willing}
                noLabel={t.common.unwilling}
              />
              <button
                onClick={() => updateSession({ currentStep: 7 })}
                className="w-full text-xs text-muted-foreground/40 hover:text-muted-foreground/60 text-center py-1 transition-colors"
              >
                {t.explore.skipToWants}
              </button>
            </div>
          )}

          {/* 步骤5 */}
          {step === 5 && (
            <div className="space-y-4">
              <StepWhen
                heading={t.explore.step5When}
                subtext={t.explore.step5WhenSubtext}
                note={interp(t.explore.step5Note, { emotion: emotionLabel })}
                onAnswer={handleChoice2}
                nowLabel={t.common.now}
                laterLabel={t.common.later}
              />
              <button
                onClick={() => updateSession({ currentStep: 7 })}
                className="w-full text-xs text-muted-foreground/40 hover:text-muted-foreground/60 text-center py-1 transition-colors"
              >
                {t.explore.skipToWants}
              </button>
            </div>
          )}

          {/* 步骤6 */}
          {step === 6 && (
            <div className="space-y-5">
              <h2 className="text-lg font-medium">{interp(t.explore.step6Heading, { emotion: emotionLabel })}</h2>
              {session.loopCount >= LOOP_WARNING_THRESHOLD && (
                <p className="text-xs text-muted-foreground">{t.explore.step6Warning}</p>
              )}
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => handleStep6Answer(true)}>{t.explore.step6More}</Button>
                <Button variant="outline" className="flex-1" onClick={() => handleStep6Answer(false)}>{t.explore.step6Done}</Button>
              </div>
            </div>
          )}

          {/* 步骤7：重新识别想要 */}
          {step === 7 && wantReidentifyMode && (
            <StepOpenText
              question={t.explore.step7Reidentify}
              subtext={t.explore.step7ReidentifySubtext}
              placeholder={t.explore.step7ReidentifyPlaceholder}
              value={wantReidentifyInput}
              onChange={setWantReidentifyInput}
              onSubmit={handleWantReidentifySubmit}
              loading={loading}
              loadingLabel={t.explore.loadingBtn}
              continueLabel={t.explore.continueBtn}
            />
          )}

          {/* 步骤7：select */}
          {step === 7 && !wantReidentifyMode && want7Phase === "select" && (
            <div className="space-y-5">
              <h2 className="text-lg font-medium">{interp(t.explore.step7Heading, { emotion: emotionLabel })}</h2>
              {loading && <p className="text-sm text-muted-foreground">{t.explore.step7Loading}</p>}
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
                    {t.explore.step7NotAccurate}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 步骤7：letgo */}
          {step === 7 && !wantReidentifyMode && want7Phase === "letgo" && selected7Want && (
            <div className="space-y-5">
              <h2 className="text-lg font-medium">{interp(t.explore.step7LetgoHeading, { want: selected7Want.label })}</h2>
              <p className="text-xs text-muted-foreground">{t.explore.step7LetgoSubtext}</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={handleWant7Letgo}>{t.explore.can}</Button>
                <Button variant="outline" className="flex-1" onClick={handleWant7Letgo}>{t.explore.cannot}</Button>
              </div>
            </div>
          )}

          {/* 步骤7：check */}
          {step === 7 && !wantReidentifyMode && want7Phase === "check" && (
            <div className="space-y-5">
              <h2 className="text-lg font-medium">{interp(t.explore.step7CheckHeading, { emotion: emotionLabel })}</h2>
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
                }}>{lang === "zh" ? "没有了" : "That's all"}</Button>
              </div>
            </div>
          )}

          {/* 步骤7：return */}
          {step === 7 && !wantReidentifyMode && want7Phase === "return" && (
            <div className="space-y-5">
              <h2 className="text-lg font-medium leading-snug">
                {interp(t.explore.step7ReturnHeading, { input: originalInput || emotionLabel })}
              </h2>
              <div className="space-y-3">
                <Textarea
                  placeholder={t.explore.step7ReturnPlaceholder}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  rows={3}
                  className="resize-none text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && textInput.trim()) {
                      e.preventDefault();
                      const input = textInput.trim();
                      captureEntry(session.identifiedEmotion, session.generatedWants);
                      setTextInput("");
                      updateSession({ currentStep: 1, identifiedEmotion: null, generatedWants: [] });
                      handleStep1Submit(input);
                    }
                  }}
                />
                <Button className="w-full" disabled={!textInput.trim()} onClick={() => {
                  const input = textInput.trim();
                  captureEntry(session.identifiedEmotion, session.generatedWants);
                  setTextInput("");
                  updateSession({ currentStep: 1, identifiedEmotion: null, generatedWants: [] });
                  handleStep1Submit(input);
                }}>{t.explore.continueBtn}</Button>
                <Button variant="outline" className="w-full" onClick={handleFinishWants}>{t.explore.step7FinishWants}</Button>
              </div>
            </div>
          )}

          {/* 步骤9：可选记录 */}
          {step === 9 && !step9Feedback && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium leading-snug">{t.explore.step9Heading}</h2>
              <p className="text-sm text-muted-foreground">{t.explore.step9Subtext}</p>
              <Textarea
                placeholder={t.explore.step9Placeholder}
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
                {loading ? t.explore.loadingBtn : textInput.trim() ? t.explore.step9Submit : t.explore.step9Complete}
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
                    {t.explore.step9Continue}
                  </Button>
                  <Button variant="ghost" className="w-full" onClick={handleStep9Complete}>
                    {t.explore.step9Finish}
                  </Button>
                </div>
              ) : (
                <Button className="w-full" onClick={handleStep9Complete}>
                  {t.explore.step9Complete}
                </Button>
              )}
            </div>
          )}
          </>}
        </div>
      </div>

      {/* 退出确认弹窗 */}
      {exitConfirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-background rounded-2xl px-6 py-6 mx-6 max-w-sm w-full shadow-xl space-y-4">
            <p className="text-base font-medium text-center">{t.common.exitConfirmTitle}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setExitConfirmOpen(false)}
                className="flex-1 py-2 rounded-xl border border-border text-sm hover:bg-muted/50 transition-colors"
              >
                {t.common.exitConfirmCancel}
              </button>
              <button
                onClick={handleExit}
                className="flex-1 py-2 rounded-xl bg-foreground text-background text-sm hover:opacity-80 transition-opacity"
              >
                {t.common.exitConfirmOk}
              </button>
            </div>
          </div>
        </div>
      )}
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
  question, subtext, placeholder, value, onChange, onSubmit, loading, loadingLabel, continueLabel,
}: {
  question: string; subtext?: string; placeholder?: string;
  value: string; onChange: (v: string) => void; onSubmit: () => void; loading: boolean;
  loadingLabel?: string; continueLabel?: string;
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
        {loading ? (loadingLabel ?? "Loading…") : (continueLabel ?? "Continue")}
      </Button>
    </div>
  );
}

function StepYesNo({ question, subtext, onAnswer, yesLabel, noLabel }: {
  question: string; subtext?: string;
  onAnswer: (answer: string) => void;
  yesLabel?: string; noLabel?: string;
}) {
  return (
    <div className="space-y-5">
      <BreathingCue />
      <h2 className="text-lg font-medium leading-snug">{question}</h2>
      {subtext && <p className="text-sm text-muted-foreground">{subtext}</p>}
      <div className="flex gap-3">
        <Button className="flex-1" onClick={() => onAnswer(yesLabel ?? "是")}>{yesLabel ?? "是"}</Button>
        <Button className="flex-1" variant="outline" onClick={() => onAnswer(noLabel ?? "否")}>{noLabel ?? "否"}</Button>
      </div>
    </div>
  );
}

function StepWhen({ onAnswer, note, heading, subtext, nowLabel, laterLabel }: {
  onAnswer: (answer: string) => void; note?: string;
  heading?: string; subtext?: string;
  nowLabel?: string; laterLabel?: string;
}) {
  return (
    <div className="space-y-5">
      <BreathingCue />
      <h2 className="text-lg font-medium">{heading ?? "什么时候？"}</h2>
      {subtext && <p className="text-sm text-muted-foreground">{subtext}</p>}
      {note && (
        <p className="text-sm text-muted-foreground/80 leading-relaxed border-l-2 border-primary/30 pl-3">{note}</p>
      )}
      <div className="flex gap-3">
        <Button className="flex-1" onClick={() => onAnswer(nowLabel ?? "现在")}>{nowLabel ?? "现在"}</Button>
        <Button className="flex-1" variant="outline" onClick={() => onAnswer(laterLabel ?? "稍后")}>{laterLabel ?? "稍后"}</Button>
      </div>
    </div>
  );
}
