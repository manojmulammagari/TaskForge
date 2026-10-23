"use client";

import {
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Activity,
  Layers,
  Sun,
  Moon,
  TextCursor,
  ShieldCheck,
} from "lucide-react";

interface AccessibilityDockProps {
  level: 1 | 2 | 3;
  setLevel: (l: 1 | 2 | 3) => void;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  highContrast: boolean;
  setHighContrast: (v: boolean) => void;
  bionic: boolean;
  setBionic: (v: boolean) => void;
  screenReaderAudio: boolean;
  setScreenReaderAudio: (v: boolean) => void;
  onSpeakBriefing: () => void;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Calm — overwhelmed / low working memory",
  2: "Structured Handoff Board",
  3: "Full Technical Audit",
};

export function AccessibilityDock({
  level,
  setLevel,
  theme,
  setTheme,
  highContrast,
  setHighContrast,
  bionic,
  setBionic,
  screenReaderAudio,
  setScreenReaderAudio,
  onSpeakBriefing,
}: AccessibilityDockProps) {
  const activeLevelClasses =
    theme === "dark"
      ? highContrast
        ? "bg-black text-white border-2 border-amber-400 shadow"
        : "bg-amber-400 text-[#0B0D11] border-2 border-amber-400 shadow"
      : "bg-white text-zinc-900 border-2 border-zinc-900 shadow";

  return (
    <aside
      className="relative z-10 w-full swiss-card p-4"
      aria-label="Accessibility & cognitive controls"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-swiss-muted">
          Cognitive Dock
        </h3>
        <button
          onClick={onSpeakBriefing}
          className="p-1.5 rounded-instrument border border-swiss-border bg-swiss-surface text-swiss-text hover:bg-amber-500/20 transition-colors"
          aria-label="Play 15-second spatial audio briefing"
          title="15-Second Spatial Audio Briefing"
        >
          <Activity className="w-4 h-4" />
          <span className="sr-only">Play briefing</span>
        </button>
      </div>

      {/* 3-Level Cognitive Slider */}
      <div className="mb-4">
        <label className="text-telemetry-xs font-bold text-swiss-text mb-2 block">
          Decompression Level
        </label>
        <div className="flex items-center gap-2 mb-1">
          {[1, 2, 3].map((l) => (
            <button
              key={l}
              onClick={() => setLevel(l as 1 | 2 | 3)}
              aria-pressed={level === l}
              className={`flex-1 py-2 rounded-instrument border text-[11px] font-mono font-bold transition-all ${
                level === l
                  ? activeLevelClasses
                  : "bg-[var(--swiss-surface)] text-[var(--swiss-muted)] border-[var(--swiss-border)] hover:bg-amber-500/10 hover:text-[var(--swiss-text)]"
              }`}
              title={LEVEL_LABELS[l]}
            >
              L{l}
            </button>
          ))}
        </div>
        <p className="text-telemetry-xs text-swiss-muted">
          {LEVEL_LABELS[level]}
        </p>
      </div>

      <div className="space-y-3">
        {/* Theme */}
        <button
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          className="w-full flex items-center justify-between py-2 px-2 rounded-instrument border border-swiss-border bg-swiss-surface text-swiss-text text-sm text-left hover:bg-amber-500/20 transition-colors"
          aria-pressed={theme === "dark"}
          title={`Switch to ${theme === "light" ? "Focus Dark" : "Calm Light"} mode`}
        >
          <span className="flex items-center gap-2">
            {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            {theme === "light"
              ? "Current Theme: Warm Paper (#FAF8F5)"
              : "Current Theme: Deep Obsidian (#0B0D11)"}
          </span>
          <span className="text-telemetry-xs text-swiss-muted">
            {theme === "light" ? "#FAF8F5" : "#0B0D11"}
          </span>
        </button>

        {/* High Contrast AAA */}
        <button
          onClick={() => setHighContrast(!highContrast)}
          className={`w-full flex items-center justify-between py-2 px-2 rounded-instrument border text-sm text-left transition-colors ${
            highContrast
              ? "bg-amber-400 text-black border-amber-400"
              : "bg-swiss-surface text-swiss-text border-swiss-border hover:bg-amber-400/20"
          }`}
          aria-pressed={highContrast}
          title="WCAG AAA high-contrast mode"
        >
          <span className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" />
            High Contrast AAA
          </span>
          <span className="text-telemetry-xs">
            {highContrast ? "ON" : "off"}
          </span>
        </button>

        {/* Bionic Reading */}
        <button
          onClick={() => setBionic(!bionic)}
          className={`w-full flex items-center justify-between py-2 px-2 rounded-instrument border text-sm text-left transition-colors ${
            bionic
              ? "bg-amber-400 text-black border-amber-400"
              : "bg-swiss-surface text-swiss-text border-swiss-border hover:bg-amber-400/20"
          }`}
          aria-pressed={bionic}
          title="Bionic reading (bold word stems)"
        >
          <span className="flex items-center gap-2">
            <TextCursor className="w-4 h-4" />
            Bionic Text
          </span>
          <span className="text-telemetry-xs">{bionic ? "ON" : "off"}</span>
        </button>

        {/* Screen-reader audio toggle */}
        <button
          onClick={() => setScreenReaderAudio(!screenReaderAudio)}
          className={`w-full flex items-center justify-between py-2 px-2 rounded-instrument border text-sm text-left transition-colors ${
            screenReaderAudio
              ? "bg-swiss-surface text-swiss-text border-swiss-border hover:bg-amber-500/20"
              : "bg-swiss-surface/50 text-swiss-muted border-swiss-border"
          }`}
          aria-pressed={screenReaderAudio}
          title="Screen-reader audio announcements"
        >
          <span className="flex items-center gap-2">
            {screenReaderAudio ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            Audio Announcements
          </span>
          <span className="text-telemetry-xs">{screenReaderAudio ? "ON" : "off"}</span>
        </button>
      </div>
    </aside>
  );
}
