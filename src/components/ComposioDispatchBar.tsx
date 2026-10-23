"use client";

import { useState } from "react";
import {
  GitBranch,
  Slack,
  Share2,
  Copy,
  Banknote,
  ShieldCheck,
  Activity,
  Terminal,
} from "lucide-react";
import { showToast } from "@/lib/toast";
import { capsuleUrlHash, compressCapsule } from "@/lib/url-capsule";
import type { ForgeStateCapsule, FidelityReceipt } from "@/lib/flowdesk-contracts";

export interface ComposioDispatchState {
  target: string;
  success: boolean;
  /** Mirrors the API response so the receipt can label sandbox vs. live. */
  sandbox?: boolean;
}

interface ComposioDispatchBarProps {
  capsule: ForgeStateCapsule | null;
  receipt: FidelityReceipt | null;
  onDispatch: (target: "github" | "slack" | "linear" | "notion") => void;
  loading: boolean;
  dispatched: ComposioDispatchState | null;
  setDispatched: (v: ComposioDispatchState | null) => void;
}

const TARGETS: Array<{
  id: "github" | "slack" | "linear" | "notion";
  label: string;
  icon: React.ElementType;
  schema: string;
}> = [
  {
    id: "github",
    label: "GitHub Issue",
    icon: GitBranch,
    schema: "GITHUB_CREATE_ISSUE",
  },
  {
    id: "slack",
    label: "Slack Channel",
    icon: Slack,
    schema: "SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL",
  },
  {
    id: "linear",
    label: "Linear Task",
    icon: Banknote,
    schema: "LINEAR_CREATE_ISSUE",
  },
  {
    id: "notion",
    label: "Notion Page",
    icon: Share2,
    schema: "NOTION_CREATE_PAGE",
  },
];

export function ComposioDispatchBar({
  capsule,
  receipt,
  onDispatch,
  loading,
  dispatched,
  setDispatched,
}: ComposioDispatchBarProps) {
  const [copied, setCopied] = useState(false);

  const handleComposio = (id: (typeof TARGETS)[number]["id"]) => {
    showToast({ title: `Dispatching to ${id}…`, variant: "info" });
    onDispatch(id);
  };

  const handleCopyShareUrl = async () => {
    if (!capsule) {
      showToast({
        title: "Forge a capsule before copying a share URL.",
        variant: "alert",
      });
      return;
    }

    try {
      // Derive the share URL from the active capsule rather than trusting a
      // potentially empty or stale document.location.hash.
      const url =
        window.location.origin +
        window.location.pathname +
        window.location.search +
        capsuleUrlHash(compressCapsule(capsule));

      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      // Only show success after the clipboard write actually resolves.
      await navigator.clipboard.writeText(url);
      setCopied(true);
      showToast({ title: "Share URL copied", variant: "success" });
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("[ForgeState] Share URL clipboard copy failed:", err);
      setCopied(false);
      showToast({
        title: "Could not copy share URL — clipboard unavailable.",
        variant: "alert",
      });
    }
  };

  const executionMode =
    dispatched?.sandbox === false
      ? "Live Composio Execution"
      : "Verified Composio Sandbox Simulation (zero auth)";

  return (
    <div className="swiss-card p-4" aria-label="Composio 1-click dispatch bar">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-instrument bg-swiss-surface border border-swiss-border flex items-center justify-center text-xs font-mono font-bold text-swiss-text" aria-hidden="true">
            C
          </div>
          <div>
            <h3 className="text-sm font-bold text-swiss-text">Composio Handoff</h3>
            <p className="text-telemetry-xs text-swiss-muted telemetry">
              1-click cross-app dispatch · GitHub · Slack · Linear · Notion
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TARGETS.map((t) => (
            <button
              key={t.id}
              onClick={() => handleComposio(t.id)}
              disabled={loading || !capsule || !receipt}
              aria-pressed={dispatched?.target === t.id}
              aria-label={`Dispatch capsule to ${t.label}`}
              className={`flex items-center gap-2 px-3 py-2 rounded-instrument border text-sm font-mono transition-all disabled:opacity-50 ${
                loading || !capsule || !receipt
                  ? "border-swiss-border/40 text-swiss-muted/40"
                  : dispatched?.target === t.id
                    ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "border-swiss-border bg-swiss-surface text-swiss-text hover:border-amber-400/50 hover:bg-amber-400/10"
              }`}
            >
              <t.icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t.label}</span>
              <span className="ml-auto text-[10px] opacity-60" aria-hidden="true">{t.schema}</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyShareUrl}
            disabled={!capsule}
            className="btn-ghost flex items-center gap-2 disabled:opacity-50"
            aria-label="Copy current URL with capsule hash"
          >
            <Copy className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Share URL"}
          </button>
        </div>
      </div>

      {/* Live receipt / simulation evidence */}
      {dispatched && (
        <div className="mt-3 border border-swiss-border rounded-instrument p-3 bg-swiss-surface/50">
          <div className="flex items-center gap-2 mb-2">
            <Terminal className="w-4 h-4 text-swiss-muted" />
            <span className="text-telemetry-xs font-bold text-swiss-text">Execution Receipt</span>
            <span className="ml-auto text-telemetry-xs">
              {dispatched.success
                ? dispatched.sandbox === false
                  ? "Live execution verified"
                  : "Sandbox verified"
                : dispatched.sandbox === false
                  ? "Live execution failed"
                  : "Sandbox failed"}
            </span>
          </div>
          <div className="text-telemetry-xs text-swiss-muted telemetry space-y-1">
            <div className="flex justify-between">
              <span>Capsule:</span>
              <span className="text-swiss-text font-mono">{capsule?.capsule_id}</span>
            </div>
            <div className="flex justify-between">
              <span>Target:</span>
              <span className="text-swiss-text font-mono">{dispatched.target}</span>
            </div>
            <div className="flex justify-between">
              <span>Mode:</span>
              <span className="text-swiss-text font-mono">{executionMode}</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={`font-mono ${dispatched.success ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-300"}`}>
                {dispatched.success ? "RECEIPT ISSUED" : "FAILED"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
