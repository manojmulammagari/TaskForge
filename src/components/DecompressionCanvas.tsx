"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Play,
  Mic,
  Copy,
  ExternalLink,
  AlertTriangle,
  Check,
  Clock,
  List,
  FileText,
  Layout,
} from "lucide-react";
import type { ForgeStateCapsule, FidelityReceipt } from "@/lib/flowdesk-contracts";
import { playEarconSequence } from "@/lib/audio-hud";

interface DecompressionCanvasProps {
  level: 1 | 2 | 3;
  capsule: ForgeStateCapsule | null;
  receipt: FidelityReceipt | null;
  rawInput: string;
  onOpenReceipt: () => void;
  onCopyUrl: () => void;
  compressed: string | null;
  bionic: boolean;
}

/**
 * Bionic reading helper: bold the leading stem of each word to aid fixation
 * for dyslexic / low-working-memory readers. Non-destructive to screen readers
 * (the full word text is preserved).
 */
function bionicText(text: string | null | undefined): JSX.Element {
  if (!text) return <span className="bionic" />;
  return (
    <span className="bionic">
      {text.split(/\s+/).map((word, i) => {
        if (!word) return <span key={i}>&nbsp;</span>;
        const stem = Math.ceil(word.length / 2);
        return (
          <span key={i} className="mr-[0.2em]">
            <strong>{word.slice(0, stem)}</strong>{word.slice(stem)}&nbsp;
          </span>
        );
      })}
    </span>
  );
}

export function DecompressionCanvas({
  level,
  capsule,
  receipt,
  rawInput,
  onOpenReceipt,
  onCopyUrl,
  compressed,
  bionic,
}: DecompressionCanvasProps) {
  // Tracks the capsule whose entry earcon has already been attempted. Using
  // the capsule ID (instead of a boolean) lets a newly compiled capsule
  // trigger feedback again while a level change does not replay it.
  const audioRef = useRef<string | null>(null);
  const [briefingPlayed, setBriefingPlayed] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const toggleStep = (id: string) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isCompleted = (id: string) => completedSteps.has(id);

  // Auto-play the earcon for each newly compiled capsule on Level 1. Browsers
  // only allow audio after user activation, so we skip the attempt when the
  // page has never been interacted with rather than forcing a suspended
  // AudioContext.
  useEffect(() => {
    if (level !== 1 || !capsule) return;
    if (audioRef.current === capsule.capsule_id) return;

    const activation =
      typeof navigator !== "undefined"
        ? (
            navigator as Navigator & {
              userActivation?: { hasBeenActive: boolean };
            }
          ).userActivation
        : undefined;

    if (activation && !activation.hasBeenActive) return;

    audioRef.current = capsule.capsule_id;
    void playEarconSequence()
      .then(() => setBriefingPlayed(true))
      .catch(() => {
        // Audio is an enhancement; never surface autoplay failures.
      });
  }, [level, capsule]);

  const handleBriefing = useCallback(async () => {
    try {
      await playEarconSequence();
      setBriefingPlayed(true);
    } catch {
      // Speech should still run if Web Audio is blocked.
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(
        `Where you left off: ${capsule?.one_sentence_summary ?? ""}. Your first two-minute step: ${capsule?.two_minute_anchor ?? ""}.`,
      );
      u.rate = 0.95;
      u.pitch = 1.05;
      u.lang = "en-US";
      window.speechSynthesis.speak(u);
    }
  }, [capsule]);

  if (!capsule) {
    return (
      <div className="swiss-card p-8 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full border border-swiss-border bg-swiss-surface flex items-center justify-center mb-4 text-swiss-muted">
          <Layout className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-swiss-text mb-2">No capsule yet</h3>
        <p className="text-swiss-muted max-w-xs">
          Forge a capsule from the capture pane to see your decompression view.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ---------- LEVEL 1: CALM ---------- */}
      {level === 1 && (
        <section
          className="swiss-card p-6 md:p-8"
          aria-label="Level 1 Calm decompression view"
        >
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-800 dark:text-amber-200 text-[11px] font-mono font-bold mb-4">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              Level 1 · Calm
            </div>
            <h2 className="text-3xl font-bold text-swiss-text mb-2 tracking-tight">
              Where you left off
            </h2>
            <p className="text-lg text-swiss-muted mb-8 leading-relaxed max-w-2xl mx-auto">
              {bionic ? bionicText(capsule.one_sentence_summary) : capsule.one_sentence_summary}
            </p>

            <div className="calm-anchor-card">
              <h3 className="text-sm font-bold text-swiss-muted uppercase tracking-wider mb-3">
                Do this 2-minute step first
              </h3>
              <div className="text-2xl font-bold text-swiss-text mb-6">
                {capsule.two_minute_anchor}
              </div>
              <button
                onClick={handleBriefing}
                className="w-full btn-primary flex items-center justify-center gap-2 py-4 text-lg"
                aria-label="Play 15-second spatial audio briefing"
              >
                {briefingPlayed ? (
                  <Mic className="w-5 h-5 animate-pulse" fill="currentColor" />
                ) : (
                  <Play className="w-5 h-5" />
                )}
                <span>15-Second Spatial Audio Briefing</span>
              </button>
              <p className="mt-4 text-telemetry-xs text-swiss-muted telemetry">
                Web Audio API earcons (300Hz→660Hz) + Web Speech API readout
              </p>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={onOpenReceipt}
                className="btn-ghost flex items-center gap-2"
                aria-label="Open fidelity receipt"
              >
                <FileText className="w-4 h-4" />
                Verify tokens
              </button>
              <button
                onClick={onCopyUrl}
                disabled={!compressed}
                className="btn-ghost flex items-center gap-2 disabled:opacity-50"
                aria-label="Copy shareable capsule URL"
              >
                <Copy className="w-4 h-4" />
                Share URL
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ---------- LEVEL 2: STRUCTURED HANDOFF BOARD ---------- */}
      {level === 2 && (
        <section
          className="swiss-card p-6 md:p-8"
          aria-label="Level 2 Structured Handoff Board"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-swiss-text">Structured Handoff Board</h2>
            <span className="text-telemetry-xs text-swiss-muted telemetry">
              3-column bento · ADHD-friendly
            </span>
          </div>

          <div className="bento-grid">
            {/* Column 1: Current Mental State */}
            <div className="swiss-card p-4 border-2 border-amber-400/30 bg-amber-400/5">
              <h3 className="text-sm font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" fill="currentColor" />
                Current Mental State
              </h3>
              <p className="text-swiss-text leading-relaxed">
                {bionic ? bionicText(capsule.mental_state) : capsule.mental_state}
              </p>
            </div>

            {/* Column 2: Dead-Ends Firewall */}
            <div className="swiss-card p-4 border-2 border-swiss-border">
              <h3 className="text-sm font-bold text-swiss-text mb-2 flex items-center gap-1">
                <List className="w-4 h-4" />
                Dead-Ends Firewall
              </h3>
              <p className="text-telemetry-xs text-swiss-muted mb-3 telemetry">
                What was already tried and failed — never repeat a dead end.
              </p>
              {capsule.dead_ends.length === 0 ? (
                <p className="text-telemetry-xs text-swiss-muted italic telemetry">
                  No dead ends recorded yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {capsule.dead_ends.map((d) => (
                    <li key={d.id} className="p-2 rounded-instrument border border-swiss-border/50 bg-swiss-surface/30 text-telemetry-xs telemetry">
                      <div className="font-bold text-swiss-text mb-1">{d.attempt}</div>
                      <div className="text-swiss-muted">{d.error}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Column 3: Ordered Micro-Steps */}
            <div className="swiss-card p-4 border-2 border-emerald-400/30 bg-emerald-400/5">
              <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300 mb-3 flex items-center gap-1">
                <Clock className="w-4 h-4" fill="currentColor" />
                Ordered Micro-Steps
              </h3>
              <ol className="space-y-3">
                {capsule.micro_steps.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-3 group"
                  >
                    <button
                      onClick={() => toggleStep(s.id)}
                      aria-pressed={isCompleted(s.id)}
                      aria-label={
                        isCompleted(s.id)
                          ? `Mark step incomplete: ${s.text}`
                          : `Mark step complete: ${s.text}`
                      }
                      className={`flex-shrink-0 w-6 h-6 rounded border flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 min-h-[28px] min-w-[28px] ${
                        isCompleted(s.id)
                          ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-500 dark:bg-emerald-500 dark:text-black"
                          : "border-swiss-border bg-swiss-surface hover:border-amber-400/50"
                      }`}
                    >
                      {isCompleted(s.id) ? (
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      ) : null}
                    </button>
                    <div className="leading-relaxed">
                      <div className={`text-sm ${
                        isCompleted(s.id)
                          ? "line-through text-swiss-muted"
                          : "text-swiss-text font-medium"
                      }`}>
                        {s.text}
                      </div>
                      <span className="text-telemetry-xs text-swiss-muted telemetry block mt-0.5">
                        {s.duration_min}-min step · {s.id}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-telemetry-xs text-swiss-muted telemetry">
                {capsule.micro_steps.length} step(s) · zero-decision re-entry
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ---------- LEVEL 3: FULL TECHNICAL AUDIT ---------- */}
      {level === 3 && (
        <section className="swiss-card p-6 md:p-8" aria-label="Level 3 Full Technical Audit">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-swiss-text">Full Technical Audit</h2>
            <span className="text-telemetry-xs text-swiss-muted telemetry">
              Raw vs Compiled · Fidelity · URL Capsule
            </span>
          </div>

          {/* Side-by-side diff */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="swiss-card p-4">
              <h3 className="text-xs font-bold text-swiss-muted uppercase tracking-wider mb-2">Raw Input</h3>
              <pre className="text-telemetry-xs overflow-auto font-mono text-swiss-text telemetry max-h-64">
                {rawInput}
              </pre>
            </div>
            <div className="swiss-card p-4">
              <h3 className="text-xs font-bold text-swiss-muted uppercase tracking-wider mb-2">Compiled Capsule</h3>
              <pre className="text-telemetry-xs overflow-auto font-mono text-swiss-text telemetry max-h-64">
                {JSON.stringify(
                  {
                    summary: capsule.one_sentence_summary,
                    anchor: capsule.two_minute_anchor,
                    state: capsule.mental_state,
                    tokens: capsule.extracted_tokens,
                    steps: capsule.micro_steps.length,
                    deadEnds: capsule.dead_ends.length,
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </div>

          {/* Diff block */}
          <div className="swiss-card p-4 mb-6">
            <h3 className="text-xs font-bold text-swiss-muted uppercase tracking-wider mb-2">
              Raw vs. Compiled Diff
            </h3>
            <pre className="text-telemetry-xs overflow-auto font-mono text-swiss-text telemetry max-h-64 border-l-2 border-amber-500 pl-3 bg-swiss-surface/30">
              {capsule.raw_vs_compiled_diff ?? "No diff available."}
            </pre>
          </div>

          {/* Fidelity evidence row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Fidelity Score", value: `${receipt?.fidelity_score ?? capsule.fidelity_score}%`, color: "emerald" },
              { label: "Tokens Extracted", value: Object.values(capsule.extracted_tokens).flat().length, color: "amber" },
              { label: "Intercepted", value: receipt?.hallucinations_intercepted ?? 0, color: "amber" },
              { label: "Auto-Repaired", value: receipt?.auto_repairs ? "Yes" : "No", color: receipt?.auto_repairs ? "amber" : "emerald" },
            ].map((m, i) => (
              <div
                key={i}
                className={`p-3 rounded-instrument border border-swiss-border bg-swiss-surface text-left`}
              >
                <div className="text-telemetry-xs text-swiss-muted font-bold uppercase tracking-wider mb-1">
                  {m.label}
                </div>
                <div className={`text-sm font-bold text-swiss-text font-mono ${
                  m.color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
                }`}>
                  {m.value}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onOpenReceipt}
              className="btn-ghost flex items-center gap-2"
              aria-label="Open full fidelity receipt modal"
            >
              <FileText className="w-4 h-4" />
              Open Fidelity Receipt
            </button>
            <button
              onClick={onCopyUrl}
              disabled={!compressed}
              className="btn-ghost flex items-center gap-2 disabled:opacity-50"
              aria-label="Copy shareable #capsule URL"
            >
              <Copy className="w-4 h-4" />
              Copy #{compressed ? "capsule=…" : "capsule"}
            </button>
            <span className="ml-auto text-telemetry-xs text-swiss-muted telemetry">
              {compressed
                ? `URL: #capsule=${compressed.slice(0, 12)}…`
                : "Forge a capsule to compress"}
            </span>
          </div>
        </section>
      )}
    </div>
  );
}
