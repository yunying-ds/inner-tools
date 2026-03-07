"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { Button } from "@/components/ui/button";
import { EmotionPicker } from "@/components/release/EmotionPicker";
import type { SavedSession, IdentifiedEmotion } from "@/types/release";

// ---- Types ----

type InputType = "topic_event" | "feeling" | "body";
type WantType = "control" | "recognition_love" | "safety";

type Screen =
  | "input_topic"          // Step 1: initial text input
  | "topic_feeling_prompt" // Step 1: AI replied, ask for feeling about topic
  | "body_guidance"        // Step 1: body sensation guidance
  | "s2_allow"             // Step 2 Q1: 可以允许这个感受存在吗？
  | "s2_letgo"             // Step 2 Q2: 可以让它离开吗？
  | "s2_wouldyou"          // Step 2 Q3: 愿意吗？
  | "s2_when"              // Step 2 Q4: 什么时候？
  | "s2_eval"              // Step 2 Q5: 现在感受如何？
  | "s2_nochange"          // Step 2: 没什么变化 sub-options
  | "s3_select"            // Step 3: 这背后是想要...？
  | "s3_letgo"             // Step 3: 可以让它离开吗？
  | "s3_check"             // Step 3: 还有三大想要吗？
  | "s3_guided_control"    // Step 3 guided: 有想要控制吗？
  | "s3_guided_love"       // Step 3 guided: 有想要认同/爱吗？
  | "s3_guided_safety"     // Step 3 guided: 有想要安全吗？
  | "return_to_topic"      // 对于topic还有什么感受吗？
  | "return_feedback"      // 释放反应反馈，回到return_to_topic
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

function saveToHistory(session: SessionState, status: "completed" | "abandoned") {
  const label = session.topicLabel || session.topic || "未知";
  const saved: SavedSession = {
    id: session.id,
    startedAt: session.startedAt,
    completedAt: Date.now(),
    status,
    identifiedEmotion: session.identifiedEmotion ?? null,
    summary: status === "completed"
      ? `释放了关于「${label}」的感受`
      : `中止了对「${label}」的释放`,
    ...(session.identifiedEmotion === null && session.feeling ? { bodyFeeling: session.feeling } : {}),
  };
  const existing = JSON.parse(localStorage.getItem("release_history") || "[]");
  localStorage.setItem("release_history", JSON.stringify([saved, ...existing]));
}

// ---- Component ----

export default function SessionPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionState>(createInitialSession);
  const [textInput, setTextInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [, setScreenHistory] = useState<Screen[]>([]);
  const [emotionPickerOpen, setEmotionPickerOpen] = useState(false);
  const [releasedWants, setReleasedWants] = useState<WantType[]>([]);
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
        router.back();
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
        body: JSON.stringify({ userInput: input }),
      });
      clearTimeout(timeout);
      const data: IdentifiedEmotion = await res.json();
      setSession((prev) => ({ ...prev, identifiedEmotion: data }));
    } catch {
      // silently fail — display falls back to raw input
    }
  }

  const screen = session.screen;
  const feeling = session.feeling || "这个感受";
  const topicLabel = session.topicLabel || session.topic || "这个";
const wantLabel: Record<WantType, string> = {
    control: "想要控制",
    recognition_love: "想要认同/爱",
    safety: "想要安全/生存",
  };

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
        body: JSON.stringify({ userInput: input }),
      });
      const data = await res.json();
      const inputType: InputType = data.inputType ?? "feeling";
      const label: string = data.label ?? input.slice(0, 10);
      const aiReply: string = data.aiReply ?? "";

      if (inputType === "topic_event") {
        update({ topic: input, topicLabel: label, inputType, aiMessage: aiReply, screen: "topic_feeling_prompt" });
      } else {
        update({ topic: input, topicLabel: label, inputType, feeling: input, identifiedEmotion: null, aiMessage: aiReply, screen: "s2_allow" });
        if (inputType === "feeling") identifyFeeling(input);
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
    update({ feeling: input, identifiedEmotion: null, screen: "s2_allow", aiMessage: null });
    setTextInput("");
    identifyFeeling(input);
  }

  function handleEmotionPickerSelect(emotion: IdentifiedEmotion) {
    setEmotionPickerOpen(false);
    const label = emotion.wordsCn?.[0] ?? emotion.words[0] ?? emotion.level;
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
        update({ screen: "s3_select", aiMessage: "感受持续存在，让我们看看背后深层的渴望", step2LoopCount: newCount });
      } else {
        update({ screen: "s2_letgo", aiMessage: null, step2LoopCount: newCount });
      }
    } else {
      if (newCount >= MAX_STEP2_LOOPS) {
        update({ screen: "s3_select", aiMessage: "让我们直接看看背后的渴望", step2LoopCount: newCount });
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
    if (has) {
      const want: WantType = from === "s3_guided_control" ? "control" : from === "s3_guided_love" ? "recognition_love" : "safety";
      setReleasedWants((prev) => prev.includes(want) ? prev : [...prev, want]);
      update({ selectedWant: want, screen: "s3_letgo", aiMessage: null });
    } else {
      const next: Record<string, Screen> = {
        s3_guided_control: "s3_guided_love",
        s3_guided_love: "s3_guided_safety",
        s3_guided_safety: "return_to_topic",
      };
      update({ screen: next[from] as Screen, aiMessage: null });
    }
  }

  // ---- Return / Complete ----

  function handleReturnFeelingSubmit() {
    if (!textInput.trim()) return;
    update({ aiMessage: textInput.trim(), screen: "return_feedback" });
    setTextInput("");
  }

  function handleComplete() {
    saveToHistory(session, "completed");
    setCompleted(true);
  }

// ---- Completion screen ----

  if (completed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center space-y-6 step-animate">
          <div className="text-3xl text-muted-foreground">✦</div>
          <h2 className="text-xl font-medium">这次释放完成了</h2>
          <p className="text-sm text-muted-foreground">你释放了关于「{topicLabel}」的感受</p>
          {(session.identifiedEmotion || session.feeling) && (
            <div className="text-left border border-border rounded-xl px-4 py-3 space-y-1.5">
              <p className="text-sm font-medium text-foreground">
                {session.identifiedEmotion ? (
                  <>
                    {session.identifiedEmotion.level}
                    {(session.identifiedEmotion.wordsCn ?? session.identifiedEmotion.words).length > 0 && (
                      <span className="font-normal text-muted-foreground"> · {(session.identifiedEmotion.wordsCn ?? session.identifiedEmotion.words).join("、")}</span>
                    )}
                    {session.identifiedEmotion.wordsEn && session.identifiedEmotion.wordsEn.length > 0 && (
                      <span className="font-normal text-muted-foreground/50"> ({session.identifiedEmotion.wordsEn.join(", ")})</span>
                    )}
                  </>
                ) : (
                  <span className="font-normal text-muted-foreground">{session.feeling}</span>
                )}
              </p>
              {releasedWants.length > 0 && (
                <p className="text-xs text-muted-foreground">背后的想要：{releasedWants.map((w) => wantLabel[w]).join("、")}</p>
              )}
            </div>
          )}
          <div className="flex flex-col gap-3 pt-2">
            <Button onClick={() => { setSession(createInitialSession()); setCompleted(false); setTextInput(""); setScreenHistory([]); setReleasedWants([]); }}>
              开始新的释放
            </Button>
            <Button variant="outline" onClick={() => router.push("/release/history")}>查看记录</Button>
            <Button variant="ghost" onClick={() => router.push("/")}>返回首页</Button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Main render ----

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40">
        <button onClick={goBack} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← 返回
        </button>
        <span className="text-xs text-muted-foreground">圣多纳释放法</span>
        <button
          onClick={() => { saveToHistory(session, "abandoned"); router.back(); }}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          退出
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 pt-10">
        <div className="max-w-lg w-full">

          {/* Context strip — stable across transitions */}
          {screen !== "input_topic" && session.topicLabel && (
            <div className="mb-6 flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2.5 py-1 rounded-full bg-muted border border-border/40 text-muted-foreground">
                {session.topicLabel}
              </span>
              {session.identifiedEmotion?.wordsCn?.[0] && (
                <span className="text-xs text-muted-foreground/60">
                  {session.identifiedEmotion.wordsCn[0]}{session.identifiedEmotion.wordsEn?.[0] ? ` · ${session.identifiedEmotion.wordsEn[0]}` : ""}
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
              <h2 className="text-xl font-medium">今天想关于什么释放？</h2>
              <p className="text-sm text-muted-foreground">可以是一个目标、一件事、一种感受，甚至是身体的感觉。</p>
              <textarea
                ref={inputRef}
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleTopicSubmit(); } }}
                placeholder="写下来……"
                className="w-full min-h-[100px] resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
                disabled={loading}
              />
              <Button className="w-full" onClick={handleTopicSubmit} disabled={!textInput.trim() || loading}>
                {loading ? "感应中……" : "继续"}
              </Button>
            </div>
          )}

          {/* topic_feeling_prompt */}
          {screen === "topic_feeling_prompt" && !emotionPickerOpen && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">对于「{topicLabel}」，你有什么感受吗？</h2>
              <p className="text-xs text-muted-foreground">不清楚也可以先写"不清楚"，保持在身体感受就好。</p>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleFeelingSubmit(); } }}
                placeholder="写下你的感受……"
                className="w-full min-h-[80px] resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <Button className="w-full" onClick={handleFeelingSubmit} disabled={!textInput.trim()}>继续</Button>
              <button
                onClick={() => setEmotionPickerOpen(true)}
                className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground text-center py-1 transition-colors"
              >
                从情绪表选择
              </button>
              <button
                onClick={() => update({ feeling: session.topic, screen: "body_guidance", aiMessage: "保持在身体的感受，不需要想清楚。" })}
                className="w-full text-xs text-muted-foreground/50 hover:text-muted-foreground text-center py-1 transition-colors"
              >
                不知道 / 不清楚
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
              <h2 className="text-xl font-medium">这个感受在身体哪里？感觉像什么？</h2>
              <p className="text-sm text-muted-foreground leading-relaxed italic">
                "It might be a strong feeling or a subtle feeling, or a mixture of feelings. Try to identify what it is, but keep mental discussion and rumination to a minimum."
              </p>
              <p className="text-sm text-muted-foreground">保持在身体的感受里，不要分析它，直接欢迎它的存在。</p>
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
                placeholder="描述一下这个感受……（可选）"
                className="w-full min-h-[80px] resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <Button className="w-full" onClick={() => {
                const val = textInput.trim();
                update({ ...(val ? { feeling: val, identifiedEmotion: null } : {}), screen: "s2_allow", aiMessage: null });
                setTextInput("");
              }}>好，我感受到了</Button>
            </div>
          )}

          {/* s2_allow */}
          {screen === "s2_allow" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">你可以允许这个「{feeling}」存在吗？</h2>
              {session.identifiedEmotion?.wordsEn?.[0] && (
                <p className="text-xs text-muted-foreground italic">
                  {session.identifiedEmotion.wordsCn?.[0] && `${session.identifiedEmotion.wordsCn[0]} · `}{session.identifiedEmotion.wordsEn[0]}
                </p>
              )}
              <p className="text-xs text-muted-foreground">无论你的答案是什么，都可以进入下一步。</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={advanceS2}>可以</Button>
                <Button variant="outline" className="flex-1" onClick={advanceS2}>不可以</Button>
              </div>
            </div>
          )}

          {/* s2_letgo */}
          {screen === "s2_letgo" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">可以让它离开吗？</h2>
              <p className="text-xs text-muted-foreground italic">Could you let it go?</p>
              <p className="text-xs text-muted-foreground">无论你的答案是什么，都可以进入下一步。</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={advanceS2}>可以</Button>
                <Button variant="outline" className="flex-1" onClick={advanceS2}>不可以</Button>
              </div>
            </div>
          )}

          {/* s2_wouldyou */}
          {screen === "s2_wouldyou" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">愿意吗？</h2>
              <p className="text-xs text-muted-foreground italic">Would you?</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={advanceS2}>愿意</Button>
                <Button variant="outline" className="flex-1" onClick={advanceS2}>不愿意</Button>
              </div>
            </div>
          )}

          {/* s2_when */}
          {screen === "s2_when" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">什么时候？</h2>
              <p className="text-xs text-muted-foreground italic">When?</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={advanceS2}>现在</Button>
                <Button variant="outline" className="flex-1" onClick={advanceS2}>稍后</Button>
              </div>
            </div>
          )}

          {/* s2_eval */}
          {screen === "s2_eval" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">现在感受如何？</h2>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Button className="flex-1" onClick={() => handleS2Eval("lighter")}>还有一些，但轻了</Button>
                  <Button variant="outline" className="flex-1" onClick={() => handleS2Eval("better")}>好多了 / 轻盈了</Button>
                </div>
                <button className="w-full text-xs text-muted-foreground/50 py-2 hover:text-muted-foreground transition-colors" onClick={() => handleS2Eval("nochange")}>没什么变化</button>
              </div>
            </div>
          )}

          {/* s2_nochange */}
          {screen === "s2_nochange" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">没关系，我们换个方式继续。</h2>
              <div className="space-y-3">
                <Button className="w-full" onClick={() => update({ screen: "return_to_topic", aiMessage: "换个角度感受一下，对于这个，你还有什么其他感受吗？" })}>
                  换个角度感受
                </Button>
                <Button variant="outline" className="w-full" onClick={() => update({ screen: "s3_select", aiMessage: null })}>
                  直接释放背后的想要
                </Button>
              </div>
            </div>
          )}

          {/* s3_select */}
          {screen === "s3_select" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">在「{feeling}」背后，你最想要的是……</h2>
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
                  不知道
                </button>
              </div>
            </div>
          )}

          {/* s3_letgo */}
          {screen === "s3_letgo" && session.selectedWant && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">可以让这个「{wantLabel[session.selectedWant]}」离开吗？</h2>
              <p className="text-xs text-muted-foreground">无论你的答案是什么，注意到它就是在释放。</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => update({ screen: "s3_check", aiMessage: null })}>可以</Button>
                <Button variant="outline" className="flex-1" onClick={() => update({ screen: "s3_check", aiMessage: null })}>不可以</Button>
              </div>
            </div>
          )}

          {/* s3_check */}
          {screen === "s3_check" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">「{feeling}」背后还有……</h2>
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
                <Button variant="outline" className="w-full" onClick={() => handleS3Check("none")}>没有了</Button>
              </div>
            </div>
          )}

          {/* s3_guided_control */}
          {screen === "s3_guided_control" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">这背后，有想要控制吗？</h2>
              <p className="text-xs text-muted-foreground">想要控制局面、让事情按你的方式进行。</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => handleGuidedWant("s3_guided_control", true)}>有</Button>
                <Button variant="outline" className="flex-1" onClick={() => handleGuidedWant("s3_guided_control", false)}>没有</Button>
              </div>
            </div>
          )}

          {/* s3_guided_love */}
          {screen === "s3_guided_love" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">这背后，有想要认同/爱吗？</h2>
              <p className="text-xs text-muted-foreground">想要被理解、被看见、被接受、被爱。</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => handleGuidedWant("s3_guided_love", true)}>有</Button>
                <Button variant="outline" className="flex-1" onClick={() => handleGuidedWant("s3_guided_love", false)}>没有</Button>
              </div>
            </div>
          )}

          {/* s3_guided_safety */}
          {screen === "s3_guided_safety" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">这背后，有想要安全/生存吗？</h2>
              <p className="text-xs text-muted-foreground">担心失去、害怕未来没有保障。</p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => handleGuidedWant("s3_guided_safety", true)}>有</Button>
                <Button variant="outline" className="flex-1" onClick={() => handleGuidedWant("s3_guided_safety", false)}>没有</Button>
              </div>
            </div>
          )}

          {/* return_feedback */}
          {screen === "return_feedback" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">你注意到了：「{session.aiMessage}」</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                打哈欠、昏昏欲睡、身体松动、干呕——这些都是系统在清理的信号。直接欢迎它，不需要分析。
              </p>
              <Button className="w-full" onClick={() => update({ screen: "return_to_topic", aiMessage: null })}>继续</Button>
            </div>
          )}

          {/* return_to_topic */}
          {screen === "return_to_topic" && (
            <div className="space-y-5">
              <h2 className="text-xl font-medium">对于「{topicLabel}」，你还有什么感受吗？</h2>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleReturnFeelingSubmit(); } }}
                placeholder="写下来……（如果没有感受了，可以选择结束）"
                className="w-full min-h-[80px] resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              <Button className="w-full" onClick={handleReturnFeelingSubmit} disabled={!textInput.trim()}>继续释放</Button>
              <Button variant="outline" className="w-full" onClick={handleComplete}>没有了，完成这次释放</Button>
            </div>
          )}

          </div>
        </div>
      </div>
    </div>
  );
}
