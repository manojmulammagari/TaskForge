"use client";

import {
  Square,
  Sparkles,
  AlertTriangle,
  ShieldCheck,
  Terminal,
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
  activePresetId?: string | null;
}

export function JudgeControlBar({
  presets,
  onPreset,
  telemetry,
  usedFallback,
  activePresetId,
}: JudgeControlBarProps) {
  return (
    <div
      className="sticky top-[57px] z-30 border-b border-swiss-border bg-swiss-bg/95 backdrop-blur-md swiss-card"
      aria-label="Judge control bar"
    >
      <div className="px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-2">
          <div className="flex gap-3">
            {[1, 2, 3, 4].map((n) => {
              const isActive = activePresetId === String(n);
              return (
                <button
                  key={n}
                  onClick={() => onPreset(String(n))}
                  aria-pressed={isActive}
                  aria-label={`Load demo preset ${n}`}
                  className={`w-9 h-9 rounded-instrument border text-xs font-mono font-bold flex items-center justify-center transition-colors ${
                    isActive
                      ? "border-amber-400 bg-amber-400/20 text-amber-600 dark:text-amber-300 ring-1 ring-amber-400"
                      : "border-swiss-border bg-swiss-surface text-swiss-text hover:bg-amber-400/20"
                  }`}
                >
                  [{n}]
                </button>
              );
            })}
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
                usedFallback === "none" || usedFallback === "hallucination-trap-simulated"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : usedFallback === "deterministic" || usedFallback === "deterministic-local"
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-swiss-muted"
              }`}
            >
              {usedFallback === "none"
                ? "LLM (Live API)"
                : usedFallback === "hallucination-trap-simulated"
                  ? "LLM (Simulated Trap)"
                  : usedFallback === "deterministic-local"
                    ? "Local Heuristic"
                    : usedFallback === "shared-link"
                      ? "Shared Link"
                      : "Deterministic Fallback"}
            </span>
            <span className="ml-2 h-4 w-px bg-swiss-border"></span>
            <span className={`font-bold ${
              telemetry?.repaired
                ? "text-amber-600 dark:text-amber-400"
                : usedFallback === "deterministic" || usedFallback === "deterministic-local"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-emerald-600 dark:text-emerald-400"
            }`}>
              {telemetry?.repaired
                ? `Fidelity: 100% (${telemetry.repaired} Auto-Repaired)`
                : usedFallback === "deterministic" || usedFallback === "deterministic-local"
                  ? "Fidelity: N/A (Heuristic)"
                  : `Fidelity: ${telemetry?.fidelity ?? 100}%`}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
