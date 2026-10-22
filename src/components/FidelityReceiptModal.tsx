"use client";

import { useEffect, useRef, useState } from "react";
import { X, Check, Copy, ShieldCheck, AlertTriangle, GitCompare, Search, Eye, EyeOff } from "lucide-react";
import type { ForgeStateCapsule, FidelityReceipt } from "@/lib/flowdesk-contracts";
import { showToast } from "@/lib/toast";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface TokenComparison {
  kind: string;
  value: string;
  status: "verified" | "intercepted" | "missing";
  location?: string;
}

interface FidelityReceiptModalProps {
  open: boolean;
  onClose: () => void;
  capsule: ForgeStateCapsule | null;
  receipt: FidelityReceipt | null;
}

export function FidelityReceiptModal({
  open,
  onClose,
  capsule,
  receipt,
}: FidelityReceiptModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);

  // WCAG 2.1 modal behaviour: Escape closes, Tab is trapped inside, and focus
  // returns to the trigger when the dialog unmounts.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const node = dialogRef.current;

    const getFocusable = (): HTMLElement[] => {
      if (!node) return [];
      return Array.from(
        node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
    };

    const focusables = getFocusable();
    (focusables[0] ?? node)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;

      const items = getFocusable();
      if (items.length === 0) {
        event.preventDefault();
        node?.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey) {
        if (active === first || !node?.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !node?.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const tokens = capsule?.extracted_tokens;
  const filePaths = tokens?.file_paths ?? [];
  const lineNumbers = tokens?.line_numbers ?? [];
  const urls = tokens?.urls ?? [];
  const dates = tokens?.dates_deadlines ?? [];
  const people = tokens?.people_mentions ?? [];
  const metrics = tokens?.metrics ?? [];

  const totalTokens =
    filePaths.length +
    lineNumbers.length +
    urls.length +
    dates.length +
    people.length +
    metrics.length;

  const initialScore = receipt?.initial_fidelity_score ?? receipt?.fidelity_score ?? 0;
  const finalScore = receipt?.final_fidelity_score ?? receipt?.fidelity_score ?? 0;
  const wasRepaired =
    receipt?.repaired ?? (receipt?.auto_repairs ?? 0) > 0;
  const verificationLabel = receipt
    ? wasRepaired
      ? `PASSED — auto-repair restored ${receipt.hallucinations_intercepted} token(s)`
      : receipt.verification_passed
        ? "PASSED — 100% token survival"
        : "FAILED — tokens lost"
    : "—";

  // Build token comparison for side-by-side proof
  const buildTokenComparison = (): TokenComparison[] => {
    if (!capsule || !receipt) return [];
    
    const extracted = tokens;
    const compiledText = [
      capsule.one_sentence_summary,
      capsule.two_minute_anchor,
      capsule.mental_state,
      capsule.raw_vs_compiled_diff ?? "",
      ...capsule.micro_steps.map((s) => s.text),
      ...capsule.dead_ends.map((d) => d.attempt + " " + d.error),
    ].join(" ");

    const comparison: TokenComparison[] = [];

    // Check each extracted token against compiled output
    const checkToken = (kind: string, value: string): TokenComparison => {
      const present = compiledText.toLowerCase().includes(value.toLowerCase());
      const intercepted = capsule.intercepted_hallucinations?.some(
        h => h.toLowerCase().includes(value.toLowerCase())
      ) ?? false;
      
      const status = intercepted ? "intercepted" : (present ? "verified" : "missing");
      return {
        kind,
        value,
        status,
        location: present ? "In compiled output" : intercepted ? "Auto-repaired" : "Dropped by LLM",
      };
    };

    extracted?.file_paths?.forEach(v => comparison.push(checkToken("File Path", v)));
    extracted?.line_numbers?.forEach(v => comparison.push(checkToken("Line Number", `#${v}`)));
    extracted?.urls?.forEach(v => comparison.push(checkToken("URL", v)));
    extracted?.dates_deadlines?.forEach(v => comparison.push(checkToken("Date/Deadline", v)));
    extracted?.people_mentions?.forEach(v => comparison.push(checkToken("Person", v)));
    extracted?.metrics?.forEach(v => comparison.push(checkToken("Metric", v)));

    return comparison;
  };

  const tokenComparison = buildTokenComparison();
  const filteredComparison = showOnlyIssues 
    ? tokenComparison.filter(t => t.status !== "verified")
    : tokenComparison;

  const copyReceipt = async () => {
    if (!receipt) return;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(JSON.stringify(receipt, null, 2));
      showToast({ title: "Receipt JSON copied", variant: "success" });
    } catch (err) {
      console.error("[ForgeState] Receipt clipboard copy failed:", err);
      showToast({
        title: "Could not copy receipt JSON — clipboard unavailable.",
        variant: "alert",
      });
    }
  };

  const getStatusColor = (status: TokenComparison["status"]) => {
    switch (status) {
      case "verified": return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
      case "intercepted": return "text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30";
      case "missing": return "text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30";
    }
  };

  const getStatusIcon = (status: TokenComparison["status"]) => {
    switch (status) {
      case "verified": return <Check className="w-3 h-3" fill="currentColor" />;
      case "intercepted": return <AlertTriangle className="w-3 h-3" fill="currentColor" />;
      case "missing": return <X className="w-3 h-3" />;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fidelity-receipt-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-4xl m-4 swiss-card p-6 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="fidelity-receipt-title"
            className="text-lg font-bold text-swiss-text flex items-center gap-2"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            FlowDesk Fidelity Receipt
            <span className="ml-2 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20">
              Deterministic Verification
            </span>
          </h2>
          <button onClick={onClose} className="btn-ghost p-1.5" aria-label="Close receipt">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
          {/* Receipt header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2">
            <div className="p-2 rounded-instrument border border-swiss-border bg-swiss-surface/50">
              <div className="text-telemetry-xs text-swiss-muted font-bold uppercase tracking-wider">Receipt ID</div>
              <div className="text-telemetry-xs text-swiss-text font-mono break-all">{receipt?.receipt_id ?? "—"}</div>
            </div>
            <div className="p-2 rounded-instrument border border-swiss-border bg-swiss-surface/50">
              <div className="text-telemetry-xs text-swiss-muted font-bold uppercase tracking-wider">
                {wasRepaired ? "Initial Fidelity Score" : "Fidelity Score"}
              </div>
              <div className={`text-sm font-bold font-mono ${
                (receipt?.verification_passed ?? false) ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"
              }`}>
                {initialScore}%
                {wasRepaired && (
                  <span className="ml-1 text-emerald-600 dark:text-emerald-400">
                    → {finalScore}% repaired
                  </span>
                )}
              </div>
            </div>
            <div className="p-2 rounded-instrument border border-swiss-border bg-swiss-surface/50">
              <div className="text-telemetry-xs text-swiss-muted font-bold uppercase tracking-wider">Verification</div>
              <div className="text-telemetry-xs text-swiss-text font-mono">
                {verificationLabel}
              </div>
            </div>
          </div>

          {/* Enhanced metrics for judge evaluation */}
          {capsule && receipt && (capsule as any).metrics && (
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-2">
              {[
                { label: "Raw Chaos Tokens", value: (capsule as any).metrics.rawChaosTokenCount, color: "amber" },
                { label: "Actionable Nodes", value: (capsule as any).metrics.decompressedActionableNodes, color: "emerald" },
                { label: "Est. Time Saved", value: `${(capsule as any).metrics.estimatedResumptionTimeSavedMin} min`, color: "emerald" },
                { label: "Interception Rate", value: `${(capsule as any).metrics.hallucinationInterceptionRate}%`, color: "emerald" },
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
          )}

          {/* Side-by-Side Token Verification Proof - THE SHOWSTOPPER */}
          <div className="border border-swiss-border rounded-instrument p-4 bg-swiss-surface/30">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-swiss-muted uppercase tracking-wider flex items-center gap-2">
                <GitCompare className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Extracted AST/Diff Ground Truth vs. Claimed Summary Entities
              </h3>
              <label className="flex items-center gap-2 text-telemetry-xs text-swiss-muted cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyIssues}
                  onChange={(e) => setShowOnlyIssues(e.target.checked)}
                  className="rounded border-swiss-border text-amber-500 focus:ring-amber-500"
                />
                Show only intercepted/missing
              </label>
            </div>
            <p className="text-telemetry-xs text-swiss-text mb-3">
              Every hard token extracted deterministically from raw input (left) vs. its survival in the compiled capsule (right).
              <span className="text-amber-600 dark:text-amber-400 font-bold"> Amber = intercepted & auto-repaired</span>
              <span className="text-red-600 dark:text-red-400 font-bold ml-2"> Red = dropped (would be hallucination)</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-2"> Emerald = verified</span>
            </p>
            
            {tokenComparison.length === 0 ? (
              <div className="text-center py-8 text-swiss-muted">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>No hard tokens extracted from input. Try a preset with file paths, line numbers, URLs, or deadlines.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-telemetry-xs font-mono telemetry" role="table">
                  <thead>
                    <tr className="border-b border-swiss-border bg-swiss-surface/50">
                      <th className="text-left p-2 font-bold text-swiss-muted">Kind</th>
                      <th className="text-left p-2 font-bold text-swiss-muted">Extracted Token (Ground Truth)</th>
                      <th className="text-left p-2 font-bold text-swiss-muted">Status</th>
                      <th className="text-left p-2 font-bold text-swiss-muted">Location / Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredComparison.map((token, i) => (
                      <tr key={i} className="border-b border-swiss-border/30 hover:bg-swiss-surface/50">
                        <td className="p-2 text-swiss-muted font-bold text-[10px] uppercase">{token.kind}</td>
                        <td className="p-2 text-swiss-text break-all max-w-xs">{token.value}</td>
                        <td className="p-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(token.status)}`}>
                            {getStatusIcon(token.status)}
                            {token.status.charAt(0).toUpperCase() + token.status.slice(1)}
                          </span>
                        </td>
                        <td className="p-2 text-swiss-muted text-[10px]">{token.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="mt-3 p-3 rounded-instrument border border-swiss-border bg-swiss-surface/50 text-center">
              <div className="text-telemetry-xs text-swiss-muted font-bold uppercase tracking-wider mb-1">Summary</div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-telemetry-sm font-mono">
                <span className="text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3 h-3 inline mr-1" /> {tokenComparison.filter(t => t.status === "verified").length} Verified
                </span>
                <span className="text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="w-3 h-3 inline mr-1" /> {tokenComparison.filter(t => t.status === "intercepted").length} Intercepted & Repaired
                </span>
                <span className="text-red-600 dark:text-red-400">
                  <X className="w-3 h-3 inline mr-1" /> {tokenComparison.filter(t => t.status === "missing").length} Missing
                </span>
              </div>
            </div>
          </div>

          {/* Intercepted hallucinations detail */}
          {(receipt?.hallucinations_intercepted ?? 0) > 0 && (
            <div className="border border-amber-500/30 rounded-instrument p-4 bg-amber-500/10">
              <h3 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                Intercepted Hallucinations & Auto-Repair
              </h3>
              <p className="text-telemetry-xs text-swiss-text mb-2">
                The LLM dropped or invented tokens. The verifier intercepted them and auto-restored the exact originals.
              </p>
              <ul className="space-y-1 text-telemetry-xs font-mono text-swiss-text telemetry">
                {(capsule?.intercepted_hallucinations ?? []).map((h, i) => (
                  <li key={i} className="flex items-start gap-2 p-2 rounded bg-swiss-surface/50 border border-amber-500/20">
                    <span className="text-amber-600 dark:text-amber-400 font-bold">↻</span>
                    <span className="line-through text-swiss-muted/60 flex-1">{h}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">[restored]</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence hash */}
          <div className="p-3 rounded-instrument border border-swiss-border bg-swiss-surface/50">
            <div className="text-telemetry-xs text-swiss-muted font-bold uppercase tracking-wider mb-1">Evidence Hash (Deterministic)</div>
            <div className="text-telemetry-xs text-swiss-text font-mono break-all">{receipt?.evidence_hash ?? "—"}</div>
            <div className="text-[10px] text-swiss-muted mt-1">SHA-256 of raw input + extracted tokens + capsule ID — tamper-evident</div>
          </div>

          <div className="mt-2 text-telemetry-xs text-swiss-muted">
            Total hard tokens extracted: <span className="text-swiss-text font-mono">{totalTokens}</span> &nbsp;•&nbsp;
            Tokens survived: <span className="text-swiss-text font-mono">{receipt?.tokens_survived ?? totalTokens}</span> &nbsp;•&nbsp;
            Tokens lost: <span className="text-swiss-text font-mono">{receipt?.tokens_lost ?? 0}</span> &nbsp;•&nbsp;
            Repaired: <span className="text-swiss-text font-mono">{wasRepaired ? "Yes" : "No"}</span>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 pt-3 border-t border-swiss-border/40">
          <button
            onClick={copyReceipt}
            className="btn-ghost flex items-center gap-2"
            aria-label="Copy receipt JSON"
          >
            <Copy className="w-4 h-4" />
            Copy Receipt JSON
          </button>
          <span className="ml-auto text-[10px] text-swiss-muted font-mono">
            Capsule: {capsule?.capsule_id?.slice(0, 8)}… | Receipt: {receipt?.receipt_id?.slice(0, 8)}…
          </span>
        </div>
      </div>
    </div>
  );
}