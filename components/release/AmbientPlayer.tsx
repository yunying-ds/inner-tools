"use client";

import { useEffect, useRef, useState } from "react";
import { Music, VolumeX } from "lucide-react";

/**
 * 疗愈环境音乐播放器
 *
 * 使用 Web Audio API 生成：
 * - 432 Hz 主音（疗愈频率）
 * - 648 Hz 纯五度泛音（和谐感）
 * - 216 Hz 低八度（温暖厚实的底音）
 * - 极缓慢的 LFO 呼吸颤音（0.07 Hz）
 * - 柔和延迟混响
 *
 * 完全在浏览器端生成，无需任何音频文件。
 */

interface AudioNodes {
  ctx: AudioContext;
  masterGain: GainNode;
  oscillators: OscillatorNode[];
  lfo: OscillatorNode;
}

function buildAudioGraph(): AudioNodes {
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();

  // 主增益（用于淡入淡出）
  const masterGain = ctx.createGain();
  masterGain.gain.setValueAtTime(0, ctx.currentTime);

  // 延迟混响（简易版）
  const delay = ctx.createDelay(2.0);
  delay.delayTime.setValueAtTime(0.35, ctx.currentTime);
  const delayFeedback = ctx.createGain();
  delayFeedback.gain.setValueAtTime(0.35, ctx.currentTime);
  const delayMix = ctx.createGain();
  delayMix.gain.setValueAtTime(0.3, ctx.currentTime);

  delay.connect(delayFeedback);
  delayFeedback.connect(delay);
  delay.connect(delayMix);
  delayMix.connect(ctx.destination);

  masterGain.connect(ctx.destination);
  masterGain.connect(delay);

  // LFO（超慢呼吸颤音 0.07Hz）
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.setValueAtTime(0.07, ctx.currentTime);
  const lfoGain = ctx.createGain();
  lfoGain.gain.setValueAtTime(0.08, ctx.currentTime);
  lfo.connect(lfoGain);
  lfoGain.connect(masterGain.gain);
  lfo.start();

  // 音调：[频率Hz, 增益]
  const tones: [number, number][] = [
    [216, 0.18],  // 低八度，温暖底音
    [432, 0.28],  // 主音 432Hz
    [648, 0.14],  // 纯五度，和谐
    [864, 0.06],  // 高八度，空灵
  ];

  const oscillators: OscillatorNode[] = tones.map(([freq, vol]) => {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, ctx.currentTime);

    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    return osc;
  });

  return { ctx, masterGain, oscillators, lfo };
}

export function AmbientPlayer() {
  const [playing, setPlaying] = useState(false);
  const nodesRef = useRef<AudioNodes | null>(null);

  useEffect(() => {
    return () => {
      if (nodesRef.current) {
        const { ctx, oscillators, lfo } = nodesRef.current;
        oscillators.forEach((o) => o.stop());
        lfo.stop();
        ctx.close();
        nodesRef.current = null;
      }
    };
  }, []);

  function toggle() {
    if (!playing) {
      if (!nodesRef.current) {
        nodesRef.current = buildAudioGraph();
      }
      const { ctx, masterGain } = nodesRef.current;
      if (ctx.state === "suspended") ctx.resume();
      // 淡入 2 秒
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 2);
      setPlaying(true);
    } else {
      const { ctx, masterGain } = nodesRef.current!;
      // 淡出 2 秒后挂起
      masterGain.gain.cancelScheduledValues(ctx.currentTime);
      masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);
      setTimeout(() => ctx.suspend(), 2200);
      setPlaying(false);
    }
  }

  return (
    <button
      onClick={toggle}
      title={playing ? "关闭疗愈音乐" : "开启疗愈音乐"}
      className={[
        "fixed bottom-6 right-6 z-50",
        "w-11 h-11 rounded-full flex items-center justify-center",
        "border border-border bg-background/80 backdrop-blur-sm",
        "shadow-sm transition-all duration-300 hover:scale-105 hover:shadow-md",
        playing ? "text-primary border-primary/40" : "text-muted-foreground",
      ].join(" ")}
    >
      {playing ? <Music size={18} /> : <VolumeX size={18} />}
    </button>
  );
}
