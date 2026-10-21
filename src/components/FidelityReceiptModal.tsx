"use client";

import { useEffect, useRef } from "react";
import { X, Check, Copy, ShieldCheck, AlertTriangle } from "lucide-react";
import type { ForgeStateCapsule, FidelityReceipt } from "@/lib/flowdesk-contracts";
import { showToast } from "@/lib/toast";

interface FidelityReceiptModalProps {
  open: boolean;
  onClose: () => void;
  capsule: ForgeStateCapsule | null;
  receipt: FidelityReceipt | null;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function FidelityReceiptModal({
  open,
  onClose,
  capsule,
  receipt,
}: FidelityReceiptModalProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null);

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
        className="relative w-full max-w-3xl m-4 swiss-card p-6 max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-4">
          <h2
            id="fidelity-receipt-title"
            className="text-lg font-bold text-swiss-text flex items-center gap-2"
          >
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            FlowDesk Fidelity Receipt
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

          {/* Token evidence */}
          <div className="border border-swiss-border rounded-instrument p-4 bg-swiss-surface/30">
            <h3 className="text-xs font-bold text-swiss-muted uppercase tracking-wider mb-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Extracted Hard Tokens (verifiable evidence)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-telemetry-xs telemetry">
              <div>
                <div className="text-swiss-muted font-bold text-[10px] uppercase">File Paths</div>
                <div className="text-swiss-text font-mono">
                  {filePaths.join(", ") || "—"}
                </div>
              </div>
              <div>
                <div className="text-swiss-muted font-bold text-[10px] uppercase">Line Numbers</div>
                <div className="text-swiss-text font-mono">
                  {lineNumbers.join(", ") || "—"}
                </div>
              </div>
              <div>
                <div className="text-swiss-muted font-bold text-[10px] uppercase">URLs</div>
                <div className="text-swiss-text font-mono break-all">
                  {urls.join(", ") || "—"}
                </div>
              </div>
              <div>
                <div className="text-swiss-muted font-bold text-[10px] uppercase">Dates / Deadlines</div>
                <div className="text-swiss-text font-mono">
                  {dates.join(", ") || "—"}
                </div>
              </div>
              <div>
                <div className="text-swiss-muted font-bold text-[10px] uppercase">People</div>
                <div className="text-swiss-text font-mono">
                  {people.join(", ") || "—"}
                </div>
              </div>
              <div>
                <div className="text-swiss-muted font-bold text-[10px] uppercase">Metrics</div>
                <div className="text-swiss-text font-mono">
                  {metrics.join(", ") || "—"}
                </div>
              </div>
            </div>
          </div>

          {/* Intercepted hallucinations */}
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
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400">↻</span>
                    <span className="line-through text-swiss-muted/60">{h}</span>
                    <span className="ml-1 text-emerald-600 dark:text-emerald-400">[restored]</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Evidence hash */}
          <div className="p-3 rounded-instrument border border-swiss-border bg-swiss-surface/50">
            <div className="text-telemetry-xs text-swiss-muted font-bold uppercase tracking-wider mb-1">Evidence Hash</div>
            <div className="text-telemetry-xs text-swiss-text font-mono break-all">{receipt?.evidence_hash ?? "—"}</div>
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
        </div>
      </div>
    </div>
  );
}
