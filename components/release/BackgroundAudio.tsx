'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Volume2, VolumeX, SkipBack, SkipForward, Info } from 'lucide-react';

const TRACKS = [
  {
    src: '/audio/siarhei_korbut-relaxation-hour-396-hz-short-pixabay-317518.mp3',
    label: '396Hz',
    effect: '释放恐惧与罪疚',
    title: 'Relaxation Hour 396Hz',
    author: 'Siarhei Korbut',
    url: 'https://pixabay.com/music/meditation-relaxation-hour-396-hz-short-317518/',
  },
  {
    src: '/audio/ribhavagrawal-417hz-frequency-ambient-music-meditationcalmingzenspiritual-music-293578.mp3',
    label: '417Hz',
    effect: '清除负面能量，促进改变',
    title: '417Hz Frequency Ambient Music',
    author: 'ribhavagrawal',
    url: 'https://pixabay.com/music/meditation-417hz-frequency-ambient-music-293578/',
  },
  {
    src: '/audio/siarhei_korbut-432-hz-meditation-short-pixabay-317516.mp3',
    label: '432Hz',
    effect: '回归自然频率，深度放松',
    title: '432Hz Meditation',
    author: 'Siarhei Korbut',
    url: 'https://pixabay.com/music/meditation-432-hz-meditation-short-317516/',
  },
];

export function BackgroundAudio() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(60);
  const [trackIndex, setTrackIndex] = useState(0);
  const [showCredit, setShowCredit] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const collapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击播放器外部时收起
  useEffect(() => {
    if (collapsed) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setCollapsed(true);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [collapsed]);

  // 音量同步
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // 切换曲目
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = TRACKS[trackIndex].src;
    audio.load();
    if (isPlaying) audio.play();
  }, [trackIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
      // 播放后 2 秒自动收起
      if (collapseTimerRef.current) clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = setTimeout(() => setCollapsed(true), 2000);
    }
  }

  function switchTrack(index: number) {
    setTrackIndex(index);
    if (!isPlaying) setIsPlaying(true);
  }

  function handleEnded() {
    switchTrack((trackIndex + 1) % TRACKS.length);
  }

  const track = TRACKS[trackIndex];

  // 收起状态：一个小图标
  if (collapsed) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <audio ref={audioRef} src={TRACKS[0].src} loop={false} onEnded={handleEnded} />
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-background/95 backdrop-blur-sm shadow-lg border border-border"
        >
          {isPlaying
            ? <Volume2 className="h-4 w-4 text-primary" />
            : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          {isPlaying && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50">
      <audio
        ref={audioRef}
        src={TRACKS[0].src}
        loop={false}
        onEnded={handleEnded}
      />

      <div className="bg-background/95 backdrop-blur-sm p-3 rounded-xl shadow-lg border border-border">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" onClick={() => switchTrack((trackIndex - 1 + TRACKS.length) % TRACKS.length)} className="h-7 w-7 shrink-0">
            <SkipBack className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>

          <Button variant="ghost" size="icon" onClick={toggle} className="h-8 w-8 shrink-0">
            {isPlaying
              ? <Volume2 className="h-4 w-4 text-primary" />
              : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </Button>

          <Button variant="ghost" size="icon" onClick={() => switchTrack((trackIndex + 1) % TRACKS.length)} className="h-7 w-7 shrink-0">
            <SkipForward className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>

          <span className="text-xs text-muted-foreground/60 shrink-0">
            {track.label} · {track.effect}
          </span>

          {isPlaying && (
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-pulse shrink-0" />
              <Slider
                value={[volume]}
                onValueChange={([v]) => setVolume(v)}
                max={100}
                step={1}
                className="w-16"
              />
            </div>
          )}

          <Button
            variant="ghost" size="icon"
            onClick={() => setShowCredit((v) => !v)}
            className="h-6 w-6 shrink-0"
          >
            <Info className="h-3 w-3 text-muted-foreground/50" />
          </Button>

        </div>

        {!isPlaying && (
          <p className="text-xs text-muted-foreground mt-1.5">点击播放疗愈音频</p>
        )}

        {showCredit && (
          <div className="mt-2 pt-2 border-t border-border text-xs text-muted-foreground/60 space-y-0.5">
            <p>
              <a href={track.url} target="_blank" rel="noopener noreferrer" className="hover:text-muted-foreground underline underline-offset-2">
                {track.title}
              </a>
            </p>
            <p>by {track.author} · Pixabay License</p>
          </div>
        )}
      </div>
    </div>
  );
}
