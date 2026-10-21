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

  const announcerRef = useRef<HTMLElement | null>(null);

  const speakAnnouncer = useCallback((message: string): void => {
    const el =
      announcerRef.current ?? document.getElementById(ANNOUNCER_ID);
    if (el) el.textContent = message;
  }, []);

  useEffect(() => {
    announcerRef.current = document.getElementById(ANNOUNCER_ID);
  }, []);

  // Align React state with the pre-hydration inline script in layout.tsx. We
  // deliberately wait until after mount before touching the theme classes so
  // the saved/system preference is never clobbered by the SSR "light" default.
  useEffect(() => {
    const html = document.documentElement;

    let storedTheme: string | null = null;
    let storedContrast: string | null = null;
    try {
      storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      storedContrast = window.localStorage.getItem(CONTRAST_STORAGE_KEY);
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

  // Restore a shareable #capsule=... link on first load.
  useEffect(() => {
    const token = parseCapsuleHash(window.location.hash);
    if (!token) return;

    const decompressed = decompressCapsule(token);
    if (!decompressed) {
      showToast({
        title: "Could not restore shared capsule — the link is corrupt.",
        variant: "alert",
      });
      speakAnnouncer(
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
      speakAnnouncer(
        "Shared resumption capsule restored with a fidelity receipt.",
      );
    } catch (err) {
      showToast({
        title: "Could not restore shared capsule — invalid capsule data.",
        variant: "alert",
      });
      speakAnnouncer(
        "The shared capsule data is invalid. Please forge a new capsule.",
      );
      console.error("[ForgeState] Failed to restore capsule hash:", err);
    }
  }, [speakAnnouncer]);

  const handlePreset = useCallback(
    (id: string) => {
      const preset = PRESETS.find((p) => p.id === id);
      if (!preset) return;
      setRawInput(preset.input.text);
      setSource(preset.input.source);
      setCapsule(null);
      setReceipt(null);
      setDispatched(null);
      setModalOpen(false);
      speakAnnouncer(`Loaded preset: ${preset.title}`);
    },
    [speakAnnouncer],
  );

  const handleForge = useCallback(async () => {
    let validated;
    try {
      validated = validateRawInput({ text: rawInput, source });
    } catch {
      speakAnnouncer("Please enter some input before forging a capsule.");
      return;
    }

    setIsForging(true);
    setLoading(true);
    speakAnnouncer("Compiling your resumption capsule...");

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
        speakAnnouncer(
          "Fidelity guardrail intercepted dropped tokens and auto-repaired the capsule. Open the receipt to verify.",
        );
      } else {
        speakAnnouncer("Capsule compiled. All extracted tokens survived verification.");
      }
    } catch (err) {
      setLoading(false);
      setIsForging(false);
      console.error("[ForgeState] Compile request failed:", err);
      speakAnnouncer("Compile failed — using deterministic fallback.");
      showToast({
        title: "Compile API unavailable — deterministic local fallback used.",
        variant: "alert",
      });

      try {
        // Local deterministic fallback if the API route errors or rejects.
        const fallback = compileDeterministic({ text: rawInput, source });
        const { capsule: repaired, receipt } = verifyFidelity(rawInput, fallback);
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
        speakAnnouncer(
          "Compile failed and the local fallback was unavailable. Your previous capsule was kept.",
        );
        showToast({
          title: "Compile failed — please try again.",
          variant: "alert",
        });
      }
    }
  }, [rawInput, source, speakAnnouncer]);

  const compressed = useMemo(() => {
    if (!capsule || typeof window === "undefined") return null;
    return compressCapsule(capsule);
  }, [capsule]);

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
      speakAnnouncer("Shareable capsule URL copied to clipboard.");
      showToast({ title: "Capsule URL copied to clipboard", variant: "success" });
    } catch (err) {
      console.error("[ForgeState] Clipboard copy failed:", err);
      speakAnnouncer(
        "Could not copy the capsule URL. Please copy it from the address bar.",
      );
      showToast({
        title: "Clipboard unavailable — copy the URL from the address bar.",
        variant: "alert",
      });
    }
  }, [compressed, speakAnnouncer]);

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

        speakAnnouncer(
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
        speakAnnouncer("Composio dispatch failed.");
        showToast({
          title: `Composio ${target} dispatch failed.`,
          variant: "alert",
        });
      }
    },
    [capsule, receipt, speakAnnouncer],
  );

  const handleOpenReceipt = useCallback(() => setModalOpen(true), []);
  const handleCloseReceipt = useCallback(() => setModalOpen(false), []);

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

  return (
    <div className="flex flex-col min-h-screen">
      <JudgeControlBar
        presets={PRESETS}
        onPreset={handlePreset}
        telemetry={telemetry}
        usedFallback={usedFallback}
        onForge={handleForge}
        loading={loading}
        isForging={isForging}
        rawInput={rawInput}
        setRawInput={setRawInput}
        setSource={setSource}
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
