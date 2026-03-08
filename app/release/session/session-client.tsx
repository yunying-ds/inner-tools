"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { EmotionPicker } from "@/components/release/EmotionPicker";
import type { SavedSession, IdentifiedEmotion } from "@/types/release";
import { useLang, interp } from "@/lib/i18n";
import type { T } from "@/lib/i18n";

// ---- Types ----

type InputType = "topic_event" | "feeling" | "body";
type WantType = "control" | "recognition_love" | "safety";

type Screen =
  | "input_topic"
  | "topic_feeling_prompt"
  | "body_guidance"
  | "s2_allow"
  | "s2_letgo"
  | "s2_wouldyou"
  | "s2_when"
  | "s2_eval"
  | "s2_nochange"
  | "s3_select"
  | "s3_letgo"
  | "s3_check"
  | "s3_guided_control"
  | "s3_guided_love"
  | "s3_guided_safety"
  | "return_to_topic"
  | "return_feedback"
  | "complete";

interface SessionState {
  id: string;
  startedAt: number;
  screen: Screen;
  topic: string;
  topicLabel: string;
  inputType: InputType | null;
  feeling: string;
  identifiedEmotion: IdentifiedEmotion | null;
  aiMessage: string | null;
  step2LoopCount: number;
  step3LoopCount: number;
  selectedWant: WantType | null;
  status: "active" | "completed" | "abandoned";
}

const MAX_STEP2_LOOPS = 5;
const MAX_STEP3_LOOPS = 10;

function createInitialSession(): SessionState {
  return {
    id: uuidv4(),
    startedAt: Date.now(),
    screen: "input_topic",
    topic: "",
    topicLabel: "",
    inputType: null,
    feeling: "",
    identifiedEmotion: null,
    aiMessage: null,
    step2LoopCount: 0,
    step3LoopCount: 0,
    selectedWant: null,
    status: "active",
  };
}

function saveToHistory(session: SessionState, status: "completed" | "abandoned", t: T) {
  const label = session.topicLabel || session.topic || t.history.unknown;
  const saved: SavedSession = {
    id: session.id,
    startedAt: session.startedAt,
    completedAt: Date.now(),
    status,
    identifiedEmotion: session.identifiedEmotion ?? null,
    summary: status === "completed"
      ? interp(t.quick.releasedSummary, { label })
      : interp(t.quick.abandonedSummary, { label }),
    ...(session.identifiedEmotion === null && session.feeling ? { bodyFeeling: session.feeling } : {}),
  };
  const existing = JSON.parse(localStorage.getItem("release_history") || "[]");
  localStorage.setItem("release_history", JSON.stringify([saved, ...existing]));
}

function emotionDisplay(emotion: IdentifiedEmotion, lang: string) {
  const level = lang === "en" ? (emotion.levelEn ?? emotion.level) : emotion.level;
  const words = lang === "en" && emotion.wordsEn && emotion.wordsEn.length > 0
    ? emotion.wordsEn
    : (emotion.wordsCn ?? emotion.words);
  return { level, words };
}

// ---- Component ----

export default function SessionPage({ onBack }: { onBack?: () => void }) {
  const router = useRouter();
  const { t, lang } = useLang();
  const [session, setSession] = useState<SessionState>(createInitialSession);
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [, setScreenHistory] = useState<Screen[]>([]);
  const [emotionPickerOpen, setEmotionPickerOpen] = useState(false);
  const [releasedWants, setReleasedWants] = useState<WantType[]>([]);
  const [guidedLetgoNext, setGuidedLetgoNext] = useState<Screen | null>(null);
  const [exitConfirmOpen, setExitConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const update = useCallback((patch: Partial<SessionState>) => {
    setSession((prev) => {
      if (patch.screen && patch.screen !== prev.screen) {
        setScreenHistory((h) => [...h, prev.screen]);
      }
      return { ...prev, ...patch };
    });
    setAnimKey((k) => k + 1);
  }, []);

  function goBack() {
    setScreenHistory((h) => {
      if (h.length === 0) {
        onBack ? onBack() : router.back();
        return h;
      }
      const prev = h[h.length - 1];
      setSession((s) => ({ ...s, screen: prev }));
      setAnimKey((k) => k + 1);
      return h.slice(0, -1);
    });
  }

  async function identifyFeeling(input: string) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch("/api/release/identify-emotion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ userInput: input, lang }),
      });
      clearTimeout(timeout);
      const data: IdentifiedEmotion = await res.json();
      setSession((prev) => ({ ...prev, identifiedEmotion: data }));
    } catch {
      // silently fail
    }
  }

  const screen = session.screen;
  const feeling = session.feeling || t.quick.feelingFallback;
  const topicLabel = session.topicLabel || session.topic || t.quick.topicFallback;

  const wantLabel: Record<WantType, string> = {
    control: t.quick.wantControl,
    recognition_love: t.quick.wantLove,
    safety: t.quick.wantSafety,
  };

  const sep = lang === "zh" ? "、" : ", ";

  // ---- Step 1 ----

  async function handleTopicSubmit() {
    if (!textInput.trim() || loading) return;
    const input = textInput.trim();
    setLoading(true);
    setTextInput("");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch("/api/release/identify-input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ userInput: input, lang }),
      });
      const data = await res.json();
      const inputType: InputType = data.inputType ?? "feeling";
      const label: string = data.label ?? input.slice(0, 10);
      const aiReply: string = data.aiReply ?? "";

      if (inputType === "topic_event" || inputType === "body") {
        update({ topic: input, topicLabel: label, inputType, aiMessage: aiReply, screen: "topic_feeling_prompt" });
      } else {
        update({ topic: input, topicLabel: label, inputType, feeling: input, identifiedEmotion: null, aiMessage: aiReply, screen: "s2_allow" });
        identifyFeeling(input);
      }
    } catch {
      update({ topic: input, topicLabel: input.slice(0, 10), inputType: "feeling", feeling: input, aiMessage: null, screen: "s2_allow" });
    } finally {
      clearTimeout(timeout);
      setLoading(false);
    }
  }

  function handleFeelingSubmit() {
    if (!textInput.trim()) return;
    const input = textInput.trim();
    setTextInput("");
    const vaguePattern = new RegExp(t.quick.vaguePattern, "i");
    if (session.inputType === "body" && vaguePattern.test(input)) {
      update({ feeling: session.topicLabel, identifiedEmotion: null, screen: "s2_allow", aiMessage: interp(t.quick.bodySensationMsg, { topic: session.topicLabel }) });
      return;
    }
    update({ feeling: input, identifiedEmotion: null, screen: "s2_allow", aiMessage: null });
    identifyFeeling(input);
  }

  function handleEmotionPickerSelect(emotion: IdentifiedEmotion) {
    setEmotionPickerOpen(false);
    const { words } = emotionDisplay(emotion, lang);
    const label = words[0] ?? emotion.level;
    update({ feeling: label, identifiedEmotion: emotion, screen: "s2_allow", aiMessage: null });
  }

  // ---- Step 2 ----

  function advanceS2() {
    const next: Partial<Record<Screen, Screen>> = {
      s2_allow: "s2_letgo",
      s2_letgo: "s2_wouldyou",
      s2_wouldyou: "s2_when",
      s2_when: "s2_eval",
    };
    const nextScreen = next[screen];
    if (nextScreen) update({ screen: nextScreen, aiMessage: null });
  }

  function handleS2Eval(result: "better" | "lighter" | "nochange") {
    const newCount = session.step2LoopCount + 1;
    if (result === "better") {
      update({ screen: "s3_select", aiMessage: null, step2LoopCount: 0 });
    } else if (result === "lighter") {
      if (newCount >= MAX_STEP2_LOOPS) {
        update({ screen: "s3_select", aiMessage: t.quick.feelingPersistsMsg, step2LoopCount: newCount });
      } else {
        update({ screen: "s2_letgo", aiMessage: null, step2LoopCount: newCount });
      }
    } else {
      if (newCount >= MAX_STEP2_LOOPS) {
        update({ screen: "s3_select", aiMessage: t.quick.directWantsMsg, step2LoopCount: newCount });
      } else {
        update({ screen: "s2_nochange", step2LoopCount: newCount });
      }
    }
  }

  // ---- Step 3 ----

  function handleS3Check(want: WantType | "none") {
    if (want === "none") {
      update({ screen: "return_to_topic", aiMessage: null, step3LoopCount: 0 });
    } else {
      const newCount = session.step3LoopCount + 1;
      if (newCount >= MAX_STEP3_LOOPS) {
        update({ screen: "return_to_topic", aiMessage: null, step3LoopCount: newCount });
      } else {
        setReleasedWants((prev) => prev.includes(want) ? prev : [...prev, want]);
        update({ selectedWant: want, screen: "s3_letgo", aiMessage: null, step3LoopCount: newCount });
      }
    }
  }

  function handleGuidedWant(from: "s3_guided_control" | "s3_guided_love" | "s3_guided_safety", has: boolean) {
    const nextGuided: Record<string, Screen> = {
      s3_guided_control: "s3_guided_love",
      s3_guided_love: "s3_guided_safety",
      s3_guided_safety: "s3_check",
    };
    if (has) {
      const want: WantType = from === "s3_guided_control" ? "control" : from === "s3_guided_love" ? "recognition_love" : "safety";
      setReleasedWants((prev) => prev.includes(want) ? prev : [...prev, want]);
      setGuidedLetgoNext(nextGuided[from]);
      update({ selectedWant: want, screen: "s3_letgo", aiMessage: null });
    } else {
      update({ screen: nextGuided[from], aiMessage: null });
    }
  }

  // ---- Return / Complete ----

  function handleReturnFeelingSubmit() {
    if (!textInput.trim()) return;
    update({ aiMessage: textInput.trim(), screen: "return_feedback" });
    setTextInput("");
  }

  function handleComplete() {
    saveToHistory(session, "completed", t);
    setCompleted(true);
  }

  // ---- Completion screen ----

  if (completed) {
    const emDisp = session.identifiedEmotion ? emotionDisplay(session.identifiedEmotion, lang) : null;
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-6 step-animate">
          <div className="text-3xl text-muted-foreground">✦</div>
          <h2 className="text-xl font-medium">{t.quick.completedHeading}</h2>
          <p className="text-sm text-muted-foreground">{interp(t.quick.completedSubtext, { topic: topicLabel })}</p>
          {(session.identifiedEmotion || session.feeling) && (
            <div className="text-left border border-border rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-sm font-medium text-foreground">
                {emDisp ? (
                  <>
                    {emDisp.level}
                    {emDisp.words.length > 0 && (
                      <span className="font-normal text-muted-foreground"> · {emDisp.words.join(sep)}</span>
                    )}
                    {lang === "zh" && session.identifiedEmotion!.wordsEn && session.identifiedEmotion!.wordsEn.length > 0 && (
                      <span className="font-normal text-muted-foreground/50"> ({session.identifiedEmotion!.wordsEn.join(", ")})</span>
                    )}
                  </>
                ) : (
                  <span className="font-normal text-muted-foreground">{session.feeling}</span>
                )}
              </p>
              {releasedWants.length > 0 && (
                <p className="text-xs text-muted-foreground">{t.quick.releasedWantsLabel}{releasedWants.map((w) => wantLabel[w]).join(sep)}</p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={() => { setSession(createInitialSession()); setCompleted(false); setTextInput(""); setScreenHistory([]); setReleasedWants([]); }}>
              {t.quick.startNew}
            </Button>
            <Button variant="outline" onClick={() => router.push("/release/history")}>{t.quick.viewHistory}</Button>
            <Button variant="ghost" onClick={() => router.push("/")}>{t.quick.goHome}</Button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Main render ----

  const emStrip = session.identifiedEmotion ? emotionDisplay(session.identifiedEmotion, lang) : null;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
        <button onClick={goBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          {t.common.back}
        </button>
        <span className="text-xs text-muted-foreground">{t.quick.headerTitle}</span>
        <button
          onClick={() => setExitConfirmOpen(true)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {t.common.exit}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 pt-10">
        <div className="max-w-lg w-full">

          {/* Context strip */}
          {screen !== "input_topic" && session.topicLabel && (
            <div className="mb-6 flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border/40 text-muted-foreground">
                {session.topicLabel}
              </span>
              {emStrip && emStrip.words[0] && (
                <span className="text-xs text-muted-foreground/60">
                  {emStrip.words[0]}
                  {lang === "zh" && session.identifiedEmotion?.wordsEn?.[0] ? ` · ${session.identifiedEmotion.wordsEn[0]}` : ""}
                </span>
              )}
            </div>
          )}

          <div key={animKey} className="step-animate w-full space-y-6">

          {session.aiMessage && screen !== "return_feedback" && (
            <p className="text-sm text-muted-foreground leading-relaxed">{session.aiMessage}</p>
          )}

          {/* input_topic */}
          {screen === "input_topic" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{t.quick.inputHeading}</h2>
              <p className="text-sm text-muted-foreground">{t.quick.inputSubtext}</p>
              <textarea
                ref={inputRef}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTopicSubmit(); } }}
                placeholder={t.quick.inputPlaceholder}
                className="w-full min-h-[100px] resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                disabled={loading}
              />
              <Button className="w-full" onClick={handleTopicSubmit} disabled={!textInput.trim() || loading}>
                {loading ? t.common.loading : t.common.continue}
              </Button>
            </div>
          )}

          {/* topic_feeling_prompt */}
          {screen === "topic_feeling_prompt" && !emotionPickerOpen && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{interp(t.quick.feelingHeading, { topic: topicLabel })}</h2>
              <p className="text-xs text-muted-foreground">{t.quick.feelingSubtext}</p>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleFeelingSubmit(); } }}
                placeholder={t.quick.feelingPlaceholder}
                className="w-full min-h-[80px] resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <Button className="w-full" onClick={handleFeelingSubmit} disabled={!textInput.trim()}>{t.common.continue}</Button>
              <button
                onClick={() => setEmotionPickerOpen(true)}
                className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground text-center py-1 transition-colors"
              >
                {t.quick.fromEmotionTable}
              </button>
              <button
                onClick={() => {
                  if (session.inputType === "body") {
                    update({ feeling: session.topicLabel, identifiedEmotion: null, screen: "s2_allow", aiMessage: interp(t.quick.bodySensationMsg, { topic: session.topicLabel }) });
                  } else {
                    update({ feeling: session.topic, screen: "body_guidance", aiMessage: null });
                  }
                }}
                className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground text-center py-1 transition-colors"
              >
                {t.quick.dontKnow}
              </button>
            </div>
          )}

          {screen === "topic_feeling_prompt" && emotionPickerOpen && (
            <EmotionPicker
              onSelect={handleEmotionPickerSelect}
              onCancel={() => setEmotionPickerOpen(false)}
            />
          )}

          {/* body_guidance */}
          {screen === "body_guidance" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{t.quick.bodyHeading}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                &quot;It might be a strong feeling or a subtle feeling, or a mixture of feelings. Try to identify what it is, but keep mental discussion and rumination to a minimum.&quot;
              </p>
              <p className="text-sm text-muted-foreground">{t.quick.bodySubtext}</p>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const val = textInput.trim();
                    update({ ...(val ? { feeling: val, identifiedEmotion: null } : {}), screen: "s2_allow", aiMessage: null });
                    setTextInput("");
                  }
                }}
                placeholder={t.quick.bodyPlaceholder}
                className="w-full min-h-[80px] resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <Button className="w-full" onClick={() => {
                const val = textInput.trim();
                update({ ...(val ? { feeling: val, identifiedEmotion: null } : {}), screen: "s2_allow", aiMessage: null });
                setTextInput("");
              }}>{t.quick.bodyBtn}</Button>
            </div>
          )}

          {/* s2_allow */}
          {screen === "s2_allow" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{interp(t.quick.allowHeading, { feeling })}</h2>
              {emStrip && emStrip.words[0] && (
                <p className="text-xs text-muted-foreground italic">
                  {emStrip.level} · {emStrip.words[0]}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{t.common.any}</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={advanceS2}>{t.common.yes}</Button>
                <Button variant="outline" className="flex-1" onClick={advanceS2}>{t.common.no}</Button>
              </div>
            </div>
          )}

          {/* s2_letgo */}
          {screen === "s2_letgo" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{t.quick.letgoHeading}</h2>
              <p className="text-xs text-muted-foreground italic">Could you let it go?</p>
              <p className="text-xs text-muted-foreground">{t.common.any}</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={advanceS2}>{t.common.yes}</Button>
                <Button variant="outline" className="flex-1" onClick={advanceS2}>{t.common.no}</Button>
              </div>
            </div>
          )}

          {/* s2_wouldyou */}
          {screen === "s2_wouldyou" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{t.quick.wouldyouHeading}</h2>
              <p className="text-xs text-muted-foreground italic">Would you?</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={advanceS2}>{t.common.willing}</Button>
                <Button variant="outline" className="flex-1" onClick={advanceS2}>{t.common.unwilling}</Button>
              </div>
            </div>
          )}

          {/* s2_when */}
          {screen === "s2_when" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{t.quick.whenHeading}</h2>
              <p className="text-xs text-muted-foreground italic">When?</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={advanceS2}>{t.common.now}</Button>
                <Button variant="outline" className="flex-1" onClick={advanceS2}>{t.common.later}</Button>
              </div>
            </div>
          )}

          {/* s2_eval */}
          {screen === "s2_eval" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{t.quick.evalHeading}</h2>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Button className="flex-1" onClick={() => handleS2Eval("lighter")}>{t.quick.lighter}</Button>
                  <Button variant="outline" className="flex-1" onClick={() => handleS2Eval("better")}>{t.quick.better}</Button>
                </div>
                <button className="w-full text-xs text-muted-foreground/50 py-2 hover:text-muted-foreground transition-colors" onClick={() => handleS2Eval("nochange")}>
                  {lang === "zh" ? "没什么变化" : "No change"}
                </button>
              </div>
            </div>
          )}

          {/* s2_nochange */}
          {screen === "s2_nochange" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{t.quick.nochangeHeading}</h2>
              <div className="space-y-3">
                <Button className="w-full" onClick={() => update({ screen: "return_to_topic", aiMessage: t.quick.changeAngleMsg })}>
                  {t.quick.changeAngle}
                </Button>
                <Button variant="outline" className="w-full" onClick={() => update({ screen: "s3_select", aiMessage: null })}>
                  {t.quick.releaseWants}
                </Button>
              </div>
            </div>
          )}

          {/* s3_select */}
          {screen === "s3_select" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{interp(t.quick.selectHeading, { feeling })}</h2>
              <div className="space-y-3">
                {(["control", "recognition_love", "safety"] as WantType[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => { setReleasedWants((prev) => prev.includes(w) ? prev : [...prev, w]); update({ selectedWant: w, screen: "s3_letgo", aiMessage: null }); }}
                    className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 active:bg-primary/5 transition-all duration-200"
                  >
                    <p className="font-medium text-sm">{wantLabel[w]}</p>
                  </button>
                ))}
                <button
                  onClick={() => update({ screen: "s3_guided_control", aiMessage: null })}
                  className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground text-center py-2 transition-colors"
                >
                  {lang === "zh" ? "不知道" : "Not sure"}
                </button>
              </div>
            </div>
          )}

          {/* s3_letgo */}
          {screen === "s3_letgo" && session.selectedWant && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{interp(lang === "zh" ? "可以让这个「{want}」离开吗？" : "Could you let this \"{want}\" go?", { want: wantLabel[session.selectedWant] })}</h2>
              <p className="text-xs text-muted-foreground">{t.quick.s3letgoSubtext}</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => { const next = guidedLetgoNext ?? "s3_check"; setGuidedLetgoNext(null); update({ screen: next, aiMessage: null }); }}>{t.common.yes}</Button>
                <Button variant="outline" className="flex-1" onClick={() => { const next = guidedLetgoNext ?? "s3_check"; setGuidedLetgoNext(null); update({ screen: next, aiMessage: null }); }}>{t.common.no}</Button>
              </div>
            </div>
          )}

          {/* s3_check */}
          {screen === "s3_check" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{interp(t.quick.checkHeading, { feeling })}</h2>
              <div className="space-y-3">
                {(["control", "recognition_love", "safety"] as WantType[]).map((w) => (
                  <button
                    key={w}
                    onClick={() => handleS3Check(w)}
                    className="w-full text-left p-4 rounded-xl border border-border hover:border-primary/30 hover:bg-muted/50 active:bg-primary/5 transition-all duration-200"
                  >
                    <p className="font-medium text-sm">{wantLabel[w]}</p>
                  </button>
                ))}
                <Button variant="outline" className="w-full" onClick={() => handleS3Check("none")}>{lang === "zh" ? "没有了" : "None"}</Button>
              </div>
            </div>
          )}

          {/* s3_guided_control */}
          {screen === "s3_guided_control" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{t.quick.guidedControlHeading}</h2>
              <p className="text-xs text-muted-foreground">{t.quick.guidedControlSubtext}</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => handleGuidedWant("s3_guided_control", true)}>{t.common.hasIt}</Button>
                <Button variant="outline" className="flex-1" onClick={() => handleGuidedWant("s3_guided_control", false)}>{t.common.noIt}</Button>
              </div>
            </div>
          )}

          {/* s3_guided_love */}
          {screen === "s3_guided_love" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{t.quick.guidedLoveHeading}</h2>
              <p className="text-xs text-muted-foreground">{t.quick.guidedLoveSubtext}</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => handleGuidedWant("s3_guided_love", true)}>{t.common.hasIt}</Button>
                <Button variant="outline" className="flex-1" onClick={() => handleGuidedWant("s3_guided_love", false)}>{t.common.noIt}</Button>
              </div>
            </div>
          )}

          {/* s3_guided_safety */}
          {screen === "s3_guided_safety" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{t.quick.guidedSafetyHeading}</h2>
              <p className="text-xs text-muted-foreground">{t.quick.guidedSafetySubtext}</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => handleGuidedWant("s3_guided_safety", true)}>{t.common.hasIt}</Button>
                <Button variant="outline" className="flex-1" onClick={() => handleGuidedWant("s3_guided_safety", false)}>{t.common.noIt}</Button>
              </div>
            </div>
          )}

          {/* return_feedback */}
          {screen === "return_feedback" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{interp(t.quick.feedbackHeading, { msg: session.aiMessage ?? "" })}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t.quick.feedbackBody}
              </p>
              <Button className="w-full" onClick={() => update({ screen: "return_to_topic", aiMessage: null })}>{t.common.continue}</Button>
            </div>
          )}

          {/* return_to_topic */}
          {screen === "return_to_topic" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">{interp(t.quick.returnHeading, { topic: topicLabel })}</h2>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReturnFeelingSubmit(); } }}
                placeholder={t.quick.returnPlaceholder}
                className="w-full min-h-[80px] resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <Button className="w-full" onClick={handleReturnFeelingSubmit} disabled={!textInput.trim()}>{t.common.continueRelease}</Button>
              <Button variant="outline" className="w-full" onClick={handleComplete}>{t.quick.finishRelease}</Button>
            </div>
          )}

          </div>
        </div>
      </div>

      {/* Exit confirm dialog */}
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
                onClick={() => { saveToHistory(session, "abandoned", t); router.back(); }}
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
