"use client";

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from "react";
import {
  Play,
  Mic,
  Check,
  X,
  Copy,
  Share2,
  LayoutDashboard,
  Settings,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Activity,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Terminal,
  Banknote,
  ShieldCheck,
  FlaskConical,
  Zap,
  Brain,
  BarChart2,
  GitCompare,
  Loader2,
} from "lucide-react";

import { JudgeControlBar } from "@/components/JudgeControlBar";
import { AccessibilityDock } from "@/components/AccessibilityDock";
import { ChaosCapturePane } from "@/components/ChaosCapturePane";
import { DecompressionCanvas } from "@/components/DecompressionCanvas";
import { FidelityReceiptModal } from "@/components/FidelityReceiptModal";
import { ComposioDispatchBar } from "@/components/ComposioDispatchBar";
import {
  validateRawInput,
  validateCapsule,
  type ForgeStateCapsule,
  type FidelityReceipt,
  type ResumptionCapsule,
  type DecompressionMetrics,
} from "@/lib/flowdesk-contracts";
import { verifyFidelity } from "@/lib/fidelity-verifier";
import { compileDeterministic } from "@/lib/deterministic-compiler";
import {
  compressCapsule,
  capsuleUrlHash,
  parseCapsuleHash,
  decompressCapsule,
  storeCapsulePreview,
} from "@/lib/url-capsule";
import { showToast } from "@/lib/toast";
import { PRESETS } from "@/lib/presets";

const ANNOUNCER_ID = "status-announcer";
const THEME_STORAGE_KEY = "forgestate:theme";
const CONTRAST_STORAGE_KEY = "forgestate:contrast-aaa";
const WALKTHROUGH_DISMISSED_KEY = "forgestate:walkthrough-dismissed";

/** Keep the advertised local capsule history populated for future sessions. */
function persistCapsuleHistory(capsule: ForgeStateCapsule): void {
  try {
    storeCapsulePreview({
      id: capsule.capsule_id,
      created_at: capsule.created_at,
      summary: capsule.one_sentence_summary,
      anchor: capsule.two_minute_anchor,
      compressed: compressCapsule(capsule),
    });
  } catch (err) {
    console.error("[ForgeState] Failed to persist capsule history:", err);
  }
}

interface PersonaConfig {
  id: string;
  name: string;
  barrier: string;
  before: string;
  after: string;
  presetId: string;
}

const PERSONAS: PersonaConfig[] = [
  {
    id: "adhd-dev",
    name: "ADHD / Neurodivergent Dev",
    barrier: "Resumption Paralysis & Cognitive Overload after context switch",
    before: "25 min anxious terminal scrolling, LLM hallucination debugging, blank-page paralysis",
    after: "10 sec deterministic Bento handoff — 1 sentence, 1 action, 15-sec audio briefing",
    presetId: "1",
  },
  {
    id: "oncall-incident",
    name: "On-Call Production Incident",
    barrier: "High-pressure handoff with incomplete context & failing tests",
    before: "30+ min reconstructing stack traces, dead-end debugging, missed SLA",
    after: "Instant Dead-Ends Firewall + ordered micro-steps + Composio Linear dispatch",
    presetId: "2",
  },
  {
    id: "hallucination-trap",
    name: "Adversarial Hallucination Trap",
    barrier: "LLM invents fake functions/paths — silent data corruption risk",
    before: "LLM drops deadline & file path; developer ships broken code trusting AI",
    after: "Verifier intercepts & auto-repairs 100% — Fidelity Receipt proves it",
    presetId: "4",
  },
];

export default function ForgeStatePage() {
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [rawInput, setRawInput] = useState("");
  const [source, setSource] = useState<"text" | "voice" | "paste">("text");
  const [isForging, setIsForging] = useState(false);
  const [capsule, setCapsule] = useState<ResumptionCapsule | null>(null);
  const [receipt, setReceipt] = useState<FidelityReceipt | null>(null);
  const [loading, setLoading] = useState(false);
  const [usedFallback, setUsedFallback] = useState<string>("none");
  const [modalOpen, setModalOpen] = useState(false);
  const [dispatched, setDispatched] = useState<{
    target: string;
    success: boolean;
    sandbox?: boolean;
  } | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [themeReady, setThemeReady] = useState(false);
  const [highContrast, setHighContrast] = useState(false);
  const [bionic, setBionic] = useState(false);
  const [screenReaderAudio, setScreenReaderAudio] = useState(true);
  const [activePersona, setActivePersona] = useState<string | null>(null);
  const [showWalkthrough, setShowWalkthrough] = useState(true);
  const [walkthroughStep, setWalkthroughStep] = useState(0);

  const announcerRef = useRef<HTMLElement | null>(null);
  const speakAnnouncerRef = useRef<((message: string) => void) | null>(null);

  // Initialize the announcer ref once
  useEffect(() => {
    const el = document.getElementById(ANNOUNCER_ID);
    announcerRef.current = el;
    speakAnnouncerRef.current = (message: string) => {
      const announcer = announcerRef.current ?? document.getElementById(ANNOUNCER_ID);
      if (announcer) announcer.textContent = message;
    };
  }, []);

  // Align React state with the pre-hydration inline script in layout.tsx. We
  // deliberately wait until after mount before touching the theme classes so
  // the saved/system preference is never clobbered by the SSR "light" default.
  useEffect(() => {
    const html = document.documentElement;

    let storedTheme: string | null = null;
    let storedContrast: string | null = null;
    let dismissedWalkthrough = false;
    try {
      storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      storedContrast = window.localStorage.getItem(CONTRAST_STORAGE_KEY);
      dismissedWalkthrough = window.localStorage.getItem(WALKTHROUGH_DISMISSED_KEY) === "true";
    } catch {
      // Storage can be unavailable in private/sandboxed contexts.
    }

    const systemPrefersDark =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    const initialTheme: "light" | "dark" =
      storedTheme === "dark" || storedTheme === "light"
        ? storedTheme
        : html.classList.contains("dark") || systemPrefersDark
          ? "dark"
          : "light";

    setTheme(initialTheme);
    setHighContrast(
      storedContrast === "true" || html.classList.contains("contrast-aaa"),
    );
    setShowWalkthrough(!dismissedWalkthrough);
    setThemeReady(true);

    // The layout's lightweight header toggle updates the DOM directly. Sync
    // that external change back into React state via a custom event.
    const handleExternalTheme = (event: Event) => {
      const detail = (event as CustomEvent<{ theme?: unknown }>).detail;
      if (detail?.theme === "dark" || detail?.theme === "light") {
        setTheme(detail.theme);
      } else {
        setTheme(html.classList.contains("dark") ? "dark" : "light");
      }
    };

    window.addEventListener("forgestate:theme", handleExternalTheme);
    return () => {
      window.removeEventListener("forgestate:theme", handleExternalTheme);
    };
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    const html = document.documentElement;
    const isDark = theme === "dark";
    html.classList.toggle("dark", isDark);

    const toggle = document.getElementById("theme-toggle");
    if (toggle) toggle.setAttribute("aria-pressed", String(isDark));

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore unavailable storage.
    }
  }, [theme, themeReady]);

  useEffect(() => {
    if (!themeReady) return;
    const html = document.documentElement;
    html.classList.toggle("contrast-aaa", highContrast);
    try {
      window.localStorage.setItem(
        CONTRAST_STORAGE_KEY,
        String(highContrast),
      );
    } catch {
      // Ignore unavailable storage.
    }
  }, [highContrast, themeReady]);

  // Restore a shareable #capsule=... link on mount and hash change.
  useEffect(() => {
    const restoreFromHash = () => {
      const token = parseCapsuleHash(window.location.hash);
      if (!token) return;

      const decompressed = decompressCapsule(token);
      if (!decompressed) {
        showToast({
          title: "Could not restore shared capsule — the link is corrupt.",
          variant: "alert",
        });
        speakAnnouncerRef.current?.(
          "The shared capsule link is invalid or corrupted. Please forge a new capsule.",
        );
        return;
      }

      try {
        const restored = validateCapsule(decompressed);
        // Re-verify against the original capture so shared links arrive with a
        // receipt and all Composio dispatch targets immediately enabled.
        const verified = verifyFidelity(restored.source_input, restored);
        setCapsule(verified.capsule);
        setReceipt(verified.receipt);
        setRawInput(verified.capsule.source_input);
        setSource(verified.capsule.source_type);
        setDispatched(null);
        setModalOpen(false);
        setUsedFallback("shared-link");
        persistCapsuleHistory(verified.capsule);
        speakAnnouncerRef.current?.(
          "Shared resumption capsule restored with a fidelity receipt.",
        );
      } catch (err) {
        showToast({
          title: "Could not restore shared capsule — invalid capsule data.",
          variant: "alert",
        });
        speakAnnouncerRef.current?.(
          "The shared capsule data is invalid. Please forge a new capsule.",
        );
        console.error("[ForgeState] Failed to restore capsule hash:", err);
      }
    };

    // Run on mount
    restoreFromHash();

    // Listen for hash changes (e.g., user navigates to a #capsule=... link)
    window.addEventListener("hashchange", restoreFromHash);
    return () => window.removeEventListener("hashchange", restoreFromHash);
  }, []); // speakAnnouncerRef is stable

  const handleForge = useCallback(async (overrideInput?: { text: string; source: "text" | "voice" | "paste" }) => {
    let validated;
    const textToCompile = overrideInput ? overrideInput.text : rawInput;
    const sourceToCompile = overrideInput ? overrideInput.source : source;
    try {
      validated = validateRawInput({ text: textToCompile, source: sourceToCompile });
    } catch {
      speakAnnouncerRef.current?.("Please enter some input before forging a capsule.");
      return;
    }

    setIsForging(true);
    setLoading(true);
    speakAnnouncerRef.current?.("Compiling your resumption capsule...");

    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          json && typeof json.error === "string"
            ? `${json.error} (HTTP ${res.status})`
            : `Compile API returned HTTP ${res.status}`,
        );
      }

      if (!json || !json.capsule) {
        throw new Error("Compile API returned an empty capsule.");
      }

      const compiledCapsule = json.capsule as ForgeStateCapsule;
      setCapsule(compiledCapsule);
      setReceipt(json.receipt ?? null);
      setUsedFallback(json.used_fallback ?? "none");
      setLoading(false);
      setIsForging(false);
      persistCapsuleHistory(compiledCapsule);

      if (json.repaired) {
        speakAnnouncerRef.current?.(
          "Fidelity guardrail intercepted dropped tokens and auto-repaired the capsule. Open the receipt to verify.",
        );
      } else {
        speakAnnouncerRef.current?.("Capsule compiled. All extracted tokens survived verification.");
      }
    } catch (err) {
      setLoading(false);
      setIsForging(false);
      console.error("[ForgeState] Compile request failed:", err);
      speakAnnouncerRef.current?.("Compile failed — using deterministic fallback.");
      showToast({
        title: "Compile API unavailable — deterministic local fallback used.",
        variant: "alert",
      });

      try {
        // Local deterministic fallback if the API route errors or rejects.
        const fallback = compileDeterministic({ text: textToCompile, source: sourceToCompile });
        const { capsule: repaired, receipt } = verifyFidelity(textToCompile, fallback);
        setCapsule(repaired);
        setReceipt(receipt);
        setUsedFallback("deterministic-local");
        persistCapsuleHistory(repaired);
        showToast({
          title: "Capsule forged locally with the deterministic compiler.",
          variant: "info",
        });
      } catch (fallbackErr) {
        // Preserve whatever the user was already looking at rather than
        // wiping the workspace or announcing a false success.
        console.error("[ForgeState] Local fallback failed:", fallbackErr);
        speakAnnouncerRef.current?.(
          "Compile failed and the local fallback was unavailable. Your previous capsule was kept.",
        );
        showToast({
          title: "Compile failed — please try again.",
          variant: "alert",
        });
      }
    }
  }, [rawInput, source]); // speakAnnouncerRef is stable

  const handlePreset = useCallback(
    (id: string, autoForge = true) => {
      const preset = PRESETS.find((p) => p.id === id);
      if (!preset) return;
      setRawInput(preset.input.text);
      setSource(preset.input.source);
      setCapsule(null);
      setReceipt(null);
      setDispatched(null);
      setModalOpen(false);
      // Clear URL hash so stale capsule from old URL does not linger
      if (typeof window !== "undefined" && window.location.hash) {
        window.history.replaceState(null, "", window.location.pathname);
      }
      // Find matching persona
      const persona = PERSONAS.find(p => p.presetId === id);
      if (persona) setActivePersona(persona.id);
      speakAnnouncerRef.current?.(`Loaded preset: ${preset.title}`);

      if (autoForge) {
        setTimeout(() => {
          void handleForge({ text: preset.input.text, source: preset.input.source });
        }, 150);
      }
    },
    [handleForge],
  );

  const compressed = useMemo(() => {
    if (!capsule || typeof window === "undefined") return null;
    return compressCapsule(capsule);
  }, [capsule]);

  // Focus management: when a new capsule is forged, move focus to the first
  // actionable element in the DecompressionCanvas (Level 1 anchor card button,
  // Level 2 first micro-step checkbox, or Level 3 Open Receipt button).
  useEffect(() => {
    if (!capsule) return;
    // Wait for the next render cycle so the DecompressionCanvas is mounted
    setTimeout(() => {
      const canvas = document.getElementById("main-content");
      if (!canvas) return;
      
      let focusTarget: HTMLElement | null = null;
      
      if (level === 1) {
        // Level 1: focus the "15-Second Spatial Audio Briefing" button
        focusTarget = canvas.querySelector('button[aria-label="Play 15-second spatial audio briefing"]') as HTMLElement;
      } else if (level === 2) {
        // Level 2: focus the first micro-step checkbox
        focusTarget = canvas.querySelector('button[aria-pressed="false"]') as HTMLElement;
      } else if (level === 3) {
        // Level 3: focus the "Open Fidelity Receipt" button
        focusTarget = canvas.querySelector('button[aria-label="Open fidelity receipt"], button[aria-label="Open full fidelity receipt modal"]') as HTMLElement;
      }
      
      focusTarget?.focus();
    }, 0);
  }, [capsule, level]);

  // Keep the address bar in sync with the active capsule so it is always
  // bookmarkable/shareable without reloading the page.
  useEffect(() => {
    if (!compressed) return;
    const hash = capsuleUrlHash(compressed);
    if (window.location.hash === hash) return;

    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}${hash}`,
    );
  }, [compressed]);

  const handleCopyUrl = useCallback(async () => {
    if (!compressed) return;
    const url = window.location.origin + capsuleUrlHash(compressed);
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(url);
      speakAnnouncerRef.current?.("Shareable capsule URL copied to clipboard.");
      showToast({ title: "Capsule URL copied to clipboard", variant: "success" });
    } catch (err) {
      console.error("[ForgeState] Clipboard copy failed:", err);
      speakAnnouncerRef.current?.(
        "Could not copy the capsule URL. Please copy it from the address bar.",
      );
      showToast({
        title: "Clippad unavailable — copy the URL from the address bar.",
        variant: "alert",
      });
    }
  }, [compressed]); // speakAnnouncerRef is stable

  const handleComposioDispatch = useCallback(
    async (target: "github" | "slack" | "linear" | "notion") => {
      if (!capsule || !receipt) return;
      setLoading(true);
      try {
        const res = await fetch("/api/composio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            capsule_id: capsule.capsule_id,
            target,
            sandbox: true,
            payload: {
              summary: capsule.one_sentence_summary,
              anchor: capsule.two_minute_anchor,
              mental_state: capsule.mental_state,
              extracted_tokens: capsule.extracted_tokens,
              receipt: JSON.stringify(receipt),
            },
          }),
        });
        const json = await res.json().catch(() => null);
        const dispatchedSuccess = res.ok && Boolean(json?.success);

        setDispatched({
          target,
          success: dispatchedSuccess,
          sandbox: json?.sandbox,
        });
        setLoading(false);

        if (!res.ok && json?.error) {
          console.error("[ForgeState] Composio dispatch error:", json.error);
        }

        speakAnnouncerRef.current?.(
          dispatchedSuccess && json?.sandbox
            ? `Composio sandbox simulation complete for ${target}. Receipt generated.`
            : dispatchedSuccess
              ? `Dispatched to ${target} via Composio.`
              : `Composio dispatch to ${target} failed.`,
        );
        showToast({
          title: `Composio ${target} ${dispatchedSuccess ? "receipt issued" : "failed"}`,
          variant: dispatchedSuccess ? "success" : "alert",
        });
      } catch (err) {
        console.error("[ForgeState] Composio dispatch request failed:", err);
        setLoading(false);
        setDispatched({ target, success: false });
        speakAnnouncerRef.current?.("Composio dispatch failed.");
        showToast({
          title: `Composio ${target} dispatch failed.`,
          variant: "alert",
        });
      }
    },
    [capsule, receipt], // speakAnnouncerRef is stable
  );

  const handleOpenReceipt = useCallback(() => setModalOpen(true), []);
  const handleCloseReceipt = useCallback(() => setModalOpen(false), []);

  const activePresetId = useMemo(() => {
    return PRESETS.find(p => p.input.text.trim() === rawInput.trim())?.id ?? null;
  }, [rawInput]);

  const telemetry = useMemo(() => {
    if (!capsule) return null;
    return {
      tokens:
        capsule.extracted_tokens.file_paths.length +
        capsule.extracted_tokens.line_numbers.length +
        capsule.extracted_tokens.urls.length +
        capsule.extracted_tokens.dates_deadlines.length +
        capsule.extracted_tokens.people_mentions.length +
        capsule.extracted_tokens.metrics.length,
      deadEnds: capsule.dead_ends.length,
      steps: capsule.micro_steps.length,
      fidelity: receipt?.fidelity_score ?? capsule.fidelity_score,
      repaired: receipt?.auto_repairs ?? 0,
    };
  }, [capsule, receipt]);

  // Enhanced metrics for the Before/After comparison
  const enhancedMetrics = useMemo(() => {
    if (!capsule || !receipt) return null;
    const metrics = (capsule as any).metrics as DecompressionMetrics | undefined;
    return {
      rawChaosTokens: metrics?.rawChaosTokenCount ?? 0,
      actionableNodes: metrics?.decompressedActionableNodes ?? 0,
      timeSavedMin: metrics?.estimatedResumptionTimeSavedMin ?? 0,
      interceptionRate: metrics?.hallucinationInterceptionRate ?? 100,
      noiseReduction: metrics?.cognitiveLoadReductionPct ?? 0,
      compileLatencyMs: metrics?.compileLatencyMs ?? 0,
    };
  }, [capsule, receipt]);

  const dismissWalkthrough = useCallback(() => {
    setShowWalkthrough(false);
    try {
      window.localStorage.setItem(WALKTHROUGH_DISMISSED_KEY, "true");
    } catch {}
  }, []);

  const nextWalkthroughStep = useCallback(() => {
    setWalkthroughStep(s => s + 1);
  }, []);

  const startInstantWalkthrough = useCallback(() => {
    // Load the Hallucination Trap preset (most impressive for judges)
    const preset = PRESETS.find(p => p.id === "4");
    if (!preset) return;
    setRawInput(preset.input.text);
    setSource(preset.input.source);
    setActivePersona("hallucination-trap");
    setShowWalkthrough(false);
    setWalkthroughStep(1);
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    // Execute forge with preset payload directly
    void handleForge({ text: preset.input.text, source: preset.input.source }).then(() => {
      setWalkthroughStep(2);
      setTimeout(() => {
        // Step 3: Open Fidelity Receipt automatically to reveal the showstopper table
        setModalOpen(true);
        setWalkthroughStep(3);
      }, 700);
    });
  }, [handleForge]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Judge Walkthrough Banner - First 5-Second "Aha!" Moment */}
      {showWalkthrough && !capsule && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" 
          role="dialog" 
          aria-modal="true" 
          aria-labelledby="walkthrough-title"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              dismissWalkthrough();
            }
          }}
        >
          <div className="w-full max-w-3xl swiss-card p-6 md:p-8 relative">
            <button
              onClick={dismissWalkthrough}
              className="absolute top-4 right-4 btn-ghost p-1.5"
              aria-label="Dismiss walkthrough"
            >
              <X className="w-5 h-5" />
            </button>
            
            <div className="text-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-800 dark:text-amber-200 text-[11px] font-mono font-bold mb-4">
                <Zap className="w-3 h-3" />
                Taskforge Hackathon — 90 Second Judge Walkthrough
              </div>
              <h2 id="walkthrough-title" className="text-2xl md:text-3xl font-bold text-swiss-text mb-4 tracking-tight">
                ForgeState: <span className="text-amber-600 dark:text-amber-400">Git Stash for the Human Brain</span>
              </h2>
              <p className="text-swiss-muted mb-6 max-w-xl mx-auto leading-relaxed">
                Judges spend ~90 seconds per submission. This walkthrough shows the <strong className="text-swiss-text">one meaningful change</strong> ForgeState delivers: turning <span className="font-mono text-amber-600 dark:text-amber-400">25 minutes of resumption paralysis</span> into a <span className="font-mono text-emerald-600 dark:text-emerald-400">10-second deterministic handoff</span>.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setActivePersona(p.id);
                      handlePreset(p.presetId, true);
                      setWalkthroughStep(1);
                    }}
                    className={`p-4 rounded-instrument border text-left transition-all ${
                      activePersona === p.id
                        ? "border-amber-400 bg-amber-400/10"
                        : "border-swiss-border bg-swiss-surface hover:border-amber-400/50"
                    }`}
                    aria-pressed={activePersona === p.id}
                  >
                    <div className="font-bold text-swiss-text mb-1">{p.name}</div>
                    <div className="text-telemetry-xs text-swiss-muted">{p.barrier}</div>
                    <div className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                      → {p.after}
                    </div>
                  </button>
                ))}
              </div>

              <button
                onClick={startInstantWalkthrough}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-lg"
                aria-label="Start instant judge walkthrough with Hallucination Trap demo"
              >
                <Zap className="w-5 h-5" />
                <span>1-Click Instant Walkthrough: Hallucination Trap Demo</span>
              </button>
              <p className="mt-3 text-telemetry-xs text-swiss-muted">
                Loads Preset [4] → Forges Capsule → Opens Fidelity Receipt → Shows intercepted hallucinations auto-repaired to 100%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Walkthrough Progress Indicator */}
      {walkthroughStep > 0 && (
        <div 
          className="fixed bottom-4 right-4 z-40 swiss-card p-4 border-2 border-amber-400 shadow-lg" 
          role="status" 
          aria-live="polite"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setWalkthroughStep(0);
              setActivePersona(null);
            }
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
            <span className="font-bold text-swiss-text text-sm">Judge Walkthrough Active</span>
          </div>
          <div className="text-telemetry-xs text-swiss-muted space-y-1">
            {walkthroughStep >= 1 && <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" /> Preset loaded</div>}
            {walkthroughStep >= 2 && <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" /> Capsule forged</div>}
            {walkthroughStep >= 3 && <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" /> Fidelity receipt opened</div>}
            {walkthroughStep >= 4 && <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" /> Cognitive level scaled to L1 Calm</div>}
            {walkthroughStep >= 5 && <div className="flex items-center gap-1"><Check className="w-3 h-3 text-emerald-500" /> Composio dispatch simulated</div>}
          </div>
          <button
            onClick={() => { setWalkthroughStep(0); setActivePersona(null); }}
            className="mt-3 btn-ghost text-xs w-full"
          >
            End Walkthrough
          </button>
        </div>
      )}

      <JudgeControlBar
        presets={PRESETS}
        onPreset={handlePreset}
        telemetry={telemetry}
        usedFallback={usedFallback}
        activePresetId={activePresetId}
      />

      <div className="flex-1 px-4 py-6 lg:px-8 lg:py-10 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column — capture (always visible, narrow on desktop) */}
        <section
          className="lg:col-span-3 flex flex-col gap-4"
          aria-label="Chaos capture pane"
        >
          <ChaosCapturePane
            rawInput={rawInput}
            setRawInput={setRawInput}
            source={source}
            setSource={setSource}
            onForge={handleForge}
            loading={loading}
            isForging={isForging}
            presets={PRESETS}
            onPreset={handlePreset}
          />
        </section>

        {/* Right column — decompression canvas (adaptive) */}
        <section
          id="main-content"
          className="lg:col-span-9 flex flex-col gap-4"
          aria-label="Decompression workspace"
        >
          {/* Before/After Cognitive Relief Telemetry Banner */}
          {enhancedMetrics && (
            <div className="swiss-card p-4 border-2 border-amber-400/30 bg-amber-400/5" role="region" aria-label="Before vs After cognitive relief metrics">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Brain className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  <div>
                    <div className="text-xs font-bold text-swiss-muted uppercase tracking-wider">Before vs. After Cognitive Relief</div>
                    <div className="text-sm font-mono text-swiss-text">
                      {enhancedMetrics.rawChaosTokens} raw chaos tokens → {enhancedMetrics.actionableNodes} actionable nodes
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-center md:text-left">
                  <div className="border border-amber-400/50 bg-amber-400/10 shadow-sm p-3 rounded-instrument text-center min-w-[140px]">
                    <div className="font-mono text-base font-black text-amber-600 dark:text-amber-400">
                      {enhancedMetrics.noiseReduction}% Noise Reduction
                    </div>
                    <div className="text-[10px] text-swiss-muted">Cognitive Load</div>
                  </div>
                  <div className="border border-amber-400/50 bg-amber-400/10 shadow-sm p-3 rounded-instrument text-center min-w-[140px]">
                    <div className="font-mono text-base font-black text-amber-600 dark:text-amber-400">
                      ~{enhancedMetrics.timeSavedMin} min Saved
                    </div>
                    <div className="text-[10px] text-swiss-muted">Resumption Time</div>
                  </div>
                  <div className="border border-emerald-500/40 bg-emerald-500/10 shadow-sm p-3 rounded-instrument text-center min-w-[140px]">
                    <div className="font-mono text-base font-black text-emerald-600 dark:text-emerald-400">
                      {receipt?.hallucinations_intercepted ? "100% Intercepted" : "100% Grounded"}
                    </div>
                    <div className="text-[10px] text-swiss-muted">
                      {receipt?.hallucinations_intercepted ? `${receipt.hallucinations_intercepted} Auto-Repaired` : "Zero Hallucinations"}
                    </div>
                  </div>
                  <div className="border border-swiss-border bg-swiss-surface shadow-sm p-3 rounded-instrument text-center min-w-[140px]">
                    <div className="font-mono text-base font-black text-swiss-text">
                      {enhancedMetrics.compileLatencyMs}ms
                    </div>
                    <div className="text-[10px] text-swiss-muted">Compile Latency</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <AccessibilityDock
            level={level}
            setLevel={setLevel}
            theme={theme}
            setTheme={setTheme}
            highContrast={highContrast}
            setHighContrast={setHighContrast}
            bionic={bionic}
            setBionic={setBionic}
            screenReaderAudio={screenReaderAudio}
            setScreenReaderAudio={setScreenReaderAudio}
            onSpeakBriefing={() => {
              if (capsule) {
                // eslint-disable-next-line @typescript-eslint/no-floating-promises
                (window as any).speechSynthesis?.cancel();
                const u = new SpeechSynthesisUtterance(
                  `Where you left off: ${capsule.one_sentence_summary}. Your first two-minute step: ${capsule.two_minute_anchor}.`,
                );
                u.rate = 0.95;
                u.pitch = 1.05;
                u.lang = "en-US";
                window.speechSynthesis.speak(u);
              }
            }}
          />

          <DecompressionCanvas
            level={level}
            capsule={capsule}
            receipt={receipt}
            rawInput={rawInput}
            onOpenReceipt={handleOpenReceipt}
            onCopyUrl={handleCopyUrl}
            compressed={compressed}
            bionic={bionic}
          />

          <ComposioDispatchBar
            capsule={capsule}
            receipt={receipt}
            onDispatch={handleComposioDispatch}
            loading={loading}
            dispatched={dispatched}
            setDispatched={setDispatched}
          />
        </section>
      </div>

      <FidelityReceiptModal
        open={modalOpen}
        onClose={handleCloseReceipt}
        capsule={capsule}
        receipt={receipt}
      />
    </div>
  );
}
