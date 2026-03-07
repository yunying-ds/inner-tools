"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { EMOTION_LEVELS } from "@/lib/release/emotions";
import type { EmotionLevelInfo, EmotionKeyword } from "@/lib/release/emotions";
import type { IdentifiedEmotion } from "@/types/release";

interface EmotionPickerProps {
  onSelect: (emotion: IdentifiedEmotion) => void;
  onCancel: () => void;
}

interface SearchResult {
  level: EmotionLevelInfo;
  keyword: EmotionKeyword;
}

export function EmotionPicker({ onSelect, onCancel }: EmotionPickerProps) {
  const [selectedLevel, setSelectedLevel] = useState<EmotionLevelInfo | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<EmotionKeyword[]>([]);
  const [search, setSearch] = useState("");

  function toggleKeyword(kw: EmotionKeyword) {
    setSelectedKeywords((prev) => {
      const exists = prev.find((k) => k.en === kw.en);
      if (exists) return prev.filter((k) => k.en !== kw.en);
      if (prev.length >= 2) return prev;
      return [...prev, kw];
    });
  }

  function handleConfirm() {
    if (!selectedLevel || selectedKeywords.length === 0) return;
    const emotion: IdentifiedEmotion = {
      words: selectedKeywords.map((k) => k.zh),
      wordsEn: selectedKeywords.map((k) => k.en),
      wordsCn: selectedKeywords.map((k) => k.zh),
      level: selectedLevel.name as IdentifiedEmotion["level"],
      levelEn: selectedLevel.nameEn,
      levelIndex: selectedLevel.index as IdentifiedEmotion["levelIndex"],
      aiReply: `你选择了「${selectedLevel.name}」——${selectedKeywords.map((k) => k.zh).join("、")}。让我们一起来释放它。`,
    };
    onSelect(emotion);
  }

  function handleSearchSelect(result: SearchResult) {
    const emotion: IdentifiedEmotion = {
      words: [result.keyword.zh],
      wordsEn: [result.keyword.en],
      wordsCn: [result.keyword.zh],
      level: result.level.name as IdentifiedEmotion["level"],
      levelEn: result.level.nameEn,
      levelIndex: result.level.index as IdentifiedEmotion["levelIndex"],
      aiReply: `你选择了「${result.level.name}」——${result.keyword.zh}。让我们一起来释放它。`,
    };
    onSelect(emotion);
  }

  const searchResults: SearchResult[] = search.trim()
    ? EMOTION_LEVELS.flatMap((level) =>
        level.keywords
          .filter((kw) => {
            const q = search.toLowerCase();
            return (
              kw.zh.includes(q) ||
              kw.en.toLowerCase().includes(q) ||
              level.name.includes(q) ||
              level.nameEn.toLowerCase().includes(q)
            );
          })
          .map((kw) => ({ level, keyword: kw }))
      )
    : [];

  // Phase 1: 选层级
  if (!selectedLevel) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-medium leading-snug">选择你现在的情绪层级</h2>
          <p className="text-sm text-muted-foreground mt-1">选最接近你当下感受的那一层</p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索情绪词……（中/英文）"
          className="w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
        {search.trim() ? (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground px-2 py-1">没有匹配的结果</p>
            ) : (
              searchResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => handleSearchSelect(r)}
                  className="w-full text-left px-4 py-2.5 rounded-xl hover:bg-muted/50 transition-all duration-150"
                >
                  <span className="text-sm font-medium">{r.keyword.zh}</span>
                  <span className="text-xs text-muted-foreground ml-1.5">{r.keyword.en}</span>
                  <span className="text-xs text-muted-foreground/50 ml-2">· {r.level.name}</span>
                </button>
              ))
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {EMOTION_LEVELS.map((level) => (
              <button
                key={level.index}
                onClick={() => { setSelectedLevel(level); setSelectedKeywords([]); }}
                className="w-full text-left px-4 py-3 rounded-xl border border-border hover:border-primary/40 hover:bg-muted/50 transition-all duration-200"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sm">{level.name}</span>
                  <span className="text-xs text-muted-foreground">{level.nameEn}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{level.core}</span>
                </div>
              </button>
            ))}
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={onCancel} className="w-full text-muted-foreground">
          返回
        </Button>
      </div>
    );
  }

  // Phase 2: 选词
  return (
    <div className="space-y-4">
      <div>
        <button
          onClick={() => { setSelectedLevel(null); setSelectedKeywords([]); setSearch(""); }}
          className="text-sm text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1"
        >
          ← 返回
        </button>
        <h2 className="text-xl font-medium leading-snug">
          {selectedLevel.name}
          <span className="text-base font-normal text-muted-foreground ml-2">/ {selectedLevel.nameEn}</span>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          选 1–2 个最贴近你感受的词
          {selectedKeywords.length > 0 && (
            <span className="ml-2 text-primary font-medium">已选 {selectedKeywords.length}/2</span>
          )}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {selectedLevel.keywords.map((kw) => {
          const isSelected = !!selectedKeywords.find((k) => k.en === kw.en);
          const isDisabled = !isSelected && selectedKeywords.length >= 2;
          return (
            <button
              key={kw.en}
              onClick={() => toggleKeyword(kw)}
              disabled={isDisabled}
              className={`text-sm px-3 py-1.5 rounded-full border transition-all duration-150 ${
                isSelected
                  ? "bg-primary text-primary-foreground border-primary"
                  : isDisabled
                  ? "border-border/40 text-muted-foreground/40 cursor-not-allowed"
                  : "border-border hover:border-primary/40 hover:bg-muted/50"
              }`}
            >
              {kw.zh}
              <span className={`ml-1 text-xs ${isSelected ? "opacity-75" : "opacity-45"}`}>
                {kw.en}
              </span>
            </button>
          );
        })}
      </div>
      <Button onClick={handleConfirm} disabled={selectedKeywords.length === 0} className="w-full">
        确认选择
      </Button>
    </div>
  );
}
