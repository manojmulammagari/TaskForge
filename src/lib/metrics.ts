/**
 * ForgeState — Shared Metrics Computation
 * 
 * Single source of truth for all metric calculations to ensure
 * consistency across JudgeControlBar, DecompressionCanvas, and API.
 */

import type { ForgeStateCapsule, FidelityReceipt } from "./flowdesk-contracts";

export interface ComputedMetrics {
  // Cognitive load metrics
  cognitiveLoadReductionPct: number;      // Clamped [15%, 95%] - for Relief Banner
  anchorWordCompressionPct: number;       // Raw vs Anchor+Summary words - for L3 Diff
  
  // Fidelity metrics
  initialFidelityScore: number;           // Pre-repair score (what LLM/parser actually earned)
  finalFidelityScore: number;             // Post-repair score (always 100% if auto-repaired)
  autoRepairs: number;                    // Count of tokens auto-repaired
  
  // Enhanced metrics for judge evaluation
  rawChaosTokenCount: number;
  decompressedActionableNodes: number;
  estimatedResumptionTimeSavedMin: number;
  hallucinationInterceptionRate: number;
  compileLatencyMs: number;
}

/**
 * Compute cognitive load reduction percentage (for Relief Banner).
 * Compares raw input word count against distilled L1 output (anchor + summary).
 * Clamped to [15%, 95%] to avoid misleading 0% or 100% edge cases.
 */
export function computeCognitiveLoadReduction(
  rawText: string,
  summary: string,
  anchor: string
): number {
  const rawWords = rawText.trim().split(/\s+/).filter(Boolean).length;
  const compressedWords = summary.trim().split(/\s+/).filter(Boolean).length +
                          anchor.trim().split(/\s+/).filter(Boolean).length;
  
  if (rawWords === 0) return 0;
  
  const pct = Math.round(((rawWords - compressedWords) / rawWords) * 100);
  return Math.max(15, Math.min(95, pct));
}

/**
 * Compute anchor word compression percentage (for L3 Diff).
 * Different denominator: compares raw words against compiled (anchor + summary) words.
 * Not clamped — shows actual compression ratio.
 */
export function computeAnchorWordCompression(
  rawText: string,
  summary: string,
  anchor: string
): number {
  const rawWords = rawText.trim().split(/\s+/).filter(Boolean).length;
  const compiledWords = summary.trim().split(/\s+/).filter(Boolean).length +
                        anchor.trim().split(/\s+/).filter(Boolean).length;
  
  if (rawWords === 0) return 0;
  
  return Math.round(((rawWords - compiledWords) / rawWords) * 100);
}

/**
 * Compute all metrics from raw input, capsule, receipt, and verification metrics.
 * This is the SINGLE SOURCE OF TRUTH for all metric displays.
 */
export function computeAllMetrics(
  rawText: string,
  capsule: ForgeStateCapsule,
  receipt: FidelityReceipt | null,
  verificationMetrics?: {
    verifiedEntities: string[];
    ungroundedEntities: string[];
  },
  compileLatencyMs: number = 0
): ComputedMetrics {
  const rawWords = rawText.trim().split(/\s+/).filter(Boolean).length;
  const summaryWords = capsule.one_sentence_summary.trim().split(/\s+/).filter(Boolean).length;
  const anchorWords = capsule.two_minute_anchor.trim().split(/\s+/).filter(Boolean).length;
  
  // Cognitive load reduction (for Relief Banner) - clamped
  const cognitiveLoadReductionPct = computeCognitiveLoadReduction(
    rawText,
    capsule.one_sentence_summary,
    capsule.two_minute_anchor
  );
  
  // Anchor word compression (for L3 Diff) - actual ratio
  const anchorWordCompressionPct = computeAnchorWordCompression(
    rawText,
    capsule.one_sentence_summary,
    capsule.two_minute_anchor
  );
  
  // Fidelity scores
  const initialFidelityScore = receipt?.initial_fidelity_score ?? receipt?.fidelity_score ?? capsule.fidelity_score;
  const finalFidelityScore = receipt?.final_fidelity_score ?? receipt?.fidelity_score ?? capsule.fidelity_score;
  const autoRepairs = receipt?.auto_repairs ?? 0;
  
  // Enhanced metrics
  const rawChaosTokenCount = rawText.split(/\s+/).filter(Boolean).length + 
    (rawText.match(/\n/g) || []).length * 2;
  
  const decompressedActionableNodes = 
    capsule.micro_steps.length + 
    capsule.dead_ends.length + 
    (capsule.extracted_tokens.file_paths.length +
     capsule.extracted_tokens.line_numbers.length +
     capsule.extracted_tokens.urls.length +
     capsule.extracted_tokens.dates_deadlines.length +
     capsule.extracted_tokens.people_mentions.length +
     capsule.extracted_tokens.metrics.length);
  
  const baseResumptionTime = 30;
  const compressionRatio = rawText.length > 0 
    ? Math.min(capsule.one_sentence_summary.length / rawText.length, 1) 
    : 0;
  const estimatedResumptionTimeSavedMin = Math.round(baseResumptionTime * (1 - compressionRatio));
  
  const totalTokens = capsule.extracted_tokens.file_paths.length +
    capsule.extracted_tokens.line_numbers.length +
    capsule.extracted_tokens.urls.length +
    capsule.extracted_tokens.dates_deadlines.length +
    capsule.extracted_tokens.people_mentions.length +
    capsule.extracted_tokens.metrics.length;
  
  const hallucinationInterceptionRate = totalTokens > 0 
    ? Math.round(((receipt?.hallucinations_intercepted ?? 0) / totalTokens) * 100)
    : 100;

  return {
    cognitiveLoadReductionPct,
    anchorWordCompressionPct,
    initialFidelityScore,
    finalFidelityScore,
    autoRepairs,
    rawChaosTokenCount,
    decompressedActionableNodes,
    estimatedResumptionTimeSavedMin,
    hallucinationInterceptionRate,
    compileLatencyMs,
  };
}

/**
 * Format fidelity display for UI components.
 * Returns object with labeled scores to prevent contradictions.
 */
export function formatFidelityDisplay(receipt: FidelityReceipt | null, capsule: ForgeStateCapsule | null) {
  if (!receipt || !capsule) {
    return {
      header: "Fidelity: —",
      detail: "Pre-Repair: — | Final: —",
      showRepairBadge: false,
    };
  }
  
  const initial = receipt.initial_fidelity_score ?? receipt.fidelity_score;
  const final = receipt.final_fidelity_score ?? receipt.fidelity_score;
  const repaired = receipt.repaired ?? false;
  const autoRepairs = receipt.auto_repairs ?? 0;
  
  if (repaired && autoRepairs > 0) {
    return {
      header: `Fidelity: 100% (${autoRepairs} Auto-Repaired)`,
      detail: `Pre-Repair: ${initial}% → Final: ${final}%`,
      showRepairBadge: true,
    };
  }
  
  return {
    header: `Fidelity: ${final}%`,
    detail: `Pre-Repair: ${initial}% | Final: ${final}%`,
    showRepairBadge: false,
  };
}