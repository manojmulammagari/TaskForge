"use client";

import { useState, useRef, useEffect } from "react";
import {
  Mic,
  Square,
  Sparkles,
  Activity,
} from "lucide-react";
import type { RawInput } from "@/lib/flowdesk-contracts";

interface ChaosCapturePaneProps {
  rawInput: string;
  setRawInput: (v: string) => void;
  source: "text" | "voice" | "paste";
  setSource: (v: "text" | "voice" | "paste") => void;
  onForge: () => void;
  loading: boolean;
  isForging: boolean;
  presets: Array<{
    id: string;
    title: string;
    subtitle: string;
    input: RawInput;
  }>;
  onPreset: (id: string) => void;
}

export function ChaosCapturePane({
  rawInput,
  setRawInput,
  source,
  setSource,
  onForge,
  loading,
  isForging,
  presets,
  onPreset,
}: ChaosCapturePaneProps) {
  const [listening, setListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  // Start disabled on both server and client so hydration is deterministic,
  // then enable the control once feature detection is available.
  const [speechSupported, setSpeechSupported] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SpeechRecognition =
    typeof window !== "undefined"
      ? ((window as any).SpeechRecognition ||
          (window as any).webkitSpeechRecognition)
      : null;

  useEffect(() => {
    setSpeechSupported(Boolean(SpeechRecognition));
  }, [SpeechRecognition]);

  useEffect(() => {
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      // Continuous dictation revises earlier results, so rebuild the whole
      // transcript from index 0 instead of slicing from resultIndex (which
      // would drop everything the user already said).
      let transcript = "";
      for (let i = 0; i < event.results.length; i++) {
        const alternative = event.results[i]?.[0];
        if (alternative?.transcript) transcript += alternative.transcript;
      }
      setVoiceTranscript(transcript);
    };
    recognition.onend = () => {
      setListening(false);
    };
    recognition.onerror = () => {
      setListening(false);
    };

    return () => {
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      try {
        recognition.abort();
      } catch {
        // Ignore abort errors on browsers that have already torn the
        // recogniser down.
      }
      if (recognitionRef.current === recognition) {
        recognitionRef.current = null;
      }
    };
  }, []);

  const startVoice = () => {
    if (!recognitionRef.current) return;
    setVoiceTranscript("");
    try {
      recognitionRef.current.start();
      setListening(true);
      setSource("voice");
    } catch (err) {
      // `start()` throws if the recogniser is already running or permission
      // was denied; keep the UI in a usable state either way.
      console.error("[ForgeState] Speech recognition failed to start:", err);
      setListening(false);
    }
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
    if (voiceTranscript.trim()) {
      setRawInput(voiceTranscript);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setRawInput(e.target.value);
    // Preserve an explicitly selected voice/paste source instead of
    // silently downgrading it to "text" on every keystroke.
  };

  return (
    <div className="flex flex-col gap-3 swiss-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-swiss-muted">
          Chaos Capture
        </h3>
        <span className="text-telemetry-xs text-swiss-muted">
          {rawInput.length} chars
        </span>
      </div>

      <div className="flex flex-col gap-2">
        <select
          value={source}
          onChange={(e) =>
            setSource((e.target.value as "text" | "voice" | "paste"))
          }
          className="w-full py-2 px-3 rounded-instrument border border-swiss-border bg-swiss-surface text-swiss-text text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
          aria-label="Input source"
        >
          <option value="text">Messy text input</option>
          <option value="voice">Voice dictation</option>
          <option value="paste">Paste / link dump</option>
        </select>

        <textarea
          value={rawInput}
          onChange={handleChange}
          rows={8}
          className="w-full py-3 px-3 rounded-instrument border border-swiss-border bg-swiss-surface text-swiss-text text-sm font-mono telemetry-base focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
          placeholder="Paste your chaotic brain dump: errors, stack traces, links, names, deadlines…"
          aria-label="Raw chaotic input"
        />

        {listening ? (
          <div className="flex items-center gap-2 animate-pulse">
            <Mic className="w-4 h-4 text-amber-500" fill="currentColor" />
            <span className="text-xs font-mono text-amber-600 dark:text-amber-400 font-bold">
              Listening… speak your dump
            </span>
            <button
              onClick={stopVoice}
              className="ml-auto p-1.5 rounded-instrument border border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              aria-label="Stop voice dictation"
            >
              <Square className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={startVoice}
              disabled={!speechSupported}
              className="flex items-center gap-2 py-2 px-3 rounded-instrument border border-swiss-border bg-swiss-surface text-swiss-text text-sm font-mono hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Start voice dictation"
              title={!speechSupported ? "Voice dictation not supported in this browser" : ""}
            >
              <Mic className="w-4 h-4" />
              Voice Dictation (Web Speech API)
            </button>
          </div>
        )}
      </div>

      {/* One-click judge presets */}
      <div className="border-t border-swiss-border/40 pt-3">
        <h4 className="text-telemetry-xs font-bold text-swiss-muted mb-2">
          Judge Demo Presets
        </h4>
        <div className="grid grid-cols-2 gap-3">
          {presets.map((p) => (
            <button
              key={p.id}
              onClick={() => onPreset(p.id)}
              className="flex flex-col gap-1 p-2 rounded-instrument border border-swiss-border bg-swiss-surface text-left hover:border-amber-500/50 hover:bg-amber-500/10 transition-colors"
              aria-label={`Load preset: ${p.title}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-swiss-text">{p.title}</span>
                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400">
                  [{p.id}]
                </span>
              </div>
              <span className="text-telemetry-xs text-swiss-muted">{p.subtitle}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <button
          onClick={onForge}
          disabled={loading || isForging || rawInput.trim().length === 0}
          className="w-full btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
          aria-label="Forge capsule from raw input"
        >
          {loading || isForging ? (
            <Activity className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          {loading || isForging ? "Forging capsule…" : "Forge Capsule"}
        </button>
      </div>
    </div>
  );
}
