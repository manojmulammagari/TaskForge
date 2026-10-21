"use client";

import {
  Play,
  Square,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  Terminal,
  Activity,
} from "lucide-react";
import type { RawInput } from "@/lib/flowdesk-contracts";

interface JudgeControlBarProps {
  presets: Array<{
    id: string;
    title: string;
    subtitle: string;
    input: RawInput;
  }>;
  onPreset: (id: string) => void;
  telemetry: {
    tokens: number;
    deadEnds: number;
    steps: number;
    fidelity: number;
    repaired: number;
  } | null;
  usedFallback: string;
  onForge: () => void;
  loading: boolean;
  isForging: boolean;
  rawInput: string;
  setRawInput: (v: string) => void;
  setSource: (v: "text" | "voice" | "paste") => void;
}

export function JudgeControlBar({
  presets,
  onPreset,
  telemetry,
  usedFallback,
  onForge,
  loading,
  isForging,
  rawInput,
  setRawInput,
  setSource,
}: JudgeControlBarProps) {
  return (
    <div
      className="sticky top-0 z-30 border-b border-swiss-border bg-swiss-bg/90 backdrop-blur-md swiss-card"
      aria-label="Judge control bar"
    >
      <div className="px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => onPreset(String(n))}
                aria-label={`Load demo preset ${n}`}
                className="w-9 h-9 rounded-instrument border border-swiss-border bg-swiss-surface text-swiss-text text-xs font-mono font-bold flex items-center justify-center hover:bg-amber-500/20 transition-colors"
              >
                [{n}]
              </button>
            ))}
          </div>
          <span className="ml-2 text-telemetry-sm text-swiss-muted telemetry">
            1-click judge presets
          </span>
        </div>

        <div className="flex flex-1 justify-end gap-2 lg:justify-end">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-swiss-border bg-swiss-surface text-telemetry-xs telemetry">
            <span className="mr-1">Compiler:</span>
            <span
              className={`font-bold ${
                usedFallback === "none"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : usedFallback === "deterministic"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-swiss-muted"
              }`}
            >
              {usedFallback === "none"
                ? "LLM"
                : usedFallback === "deterministic-local"
                  ? "Local fallback"
                  : usedFallback === "shared-link"
                    ? "Shared link"
                    : "Fallback"}
            </span>
            <span className="ml-2 h-4 w-px bg-swiss-border"></span>
            <span className={`font-bold ${
              telemetry?.repaired ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
            }`}>
              Fidelity: {telemetry?.fidelity ?? 100}%
            </span>
          </div>

          <button
            onClick={onForge}
            disabled={loading || isForging || rawInput.trim().length === 0}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
            aria-label="Forge capsule from raw input"
          >
            {loading || isForging ? (
              <Activity className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{loading || isForging ? "Forging…" : "Forge Capsule"}</span>
          </button>
        </div>
      </div>

    </div>
  );
}
