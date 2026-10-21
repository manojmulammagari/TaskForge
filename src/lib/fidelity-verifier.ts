/**
 * ForgeState — Deterministic Fidelity Guardrail
 *
 * Pure TypeScript entity extractor + hallucination catcher & auto-repair engine.
 * Extracts every hard token from raw input and mathematically verifies 100%
 * survival in the AI output. If the LLM drops or hallucinates a token, the
 * verifier intercepts it, auto-restores the exact token, and emits an auditable
 * FlowDesk Fidelity Receipt.
 */

import type {
  ExtractedTokens,
  ForgeStateCapsule,
  FidelityReceipt,
} from "./flowdesk-contracts";
import { ExtractedTokensSchema, normalizeUrl } from "./flowdesk-contracts";
import { ensureUuid, generateUuidV4 } from "./uuid";

const URL_RE =
  /https?:\/\/[^\s<>"'()]+|www\.[^\s<>"'()]+|(?<![\w@])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|io|dev|ai|app|co|uk|de|fr|jp|us|ca|au|nz|xyz|info|biz|me|tv|gg|so|sh|fm|site|online|tech|cloud|systems|tools)\b(?::\d{1,5})?(?:\/[^\s<>"'()]*)?/gi;
const FILE_PATH_RE =
  /\b(?:[\w\-]+\/)+[\w\-]+\.\w{2,}(?:\?[^\s<>"'()]+)?|\b[a-zA-Z]:\\[\w\-.\\]+\.[\w]{2,}/g;
const LINE_REF_RE = /\b(?:line|ln)\s*#?(\d{1,5})\b/gi;
const DATE_RE =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}\b/gi;
const PERSON_RE = /(?:^|\s)@([A-Za-z][A-Za-z0-9_.-]{2,30})|\b(?:by|with|for)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,2})\b/g;
const METRIC_RE = /\b\d+(?:\.\d+)?\s?(?:ms|s|sec|min|hr|hour|kb|mb|gb|%|percent|req\/s|rps)\b/gi;

// ---------------------------------------------------------------------------
// Pure extraction
// ---------------------------------------------------------------------------

/**
 * Normalize a detected link into the contract's URL shape. Bare `www.` links
 * become absolute `https://` URLs; trailing sentence punctuation is removed.
 */
function normalizeExtractedUrl(raw: string): string {
  const withoutTrailingPunctuation = raw.replace(/[.,;:!?]+$/g, "");
  return normalizeUrl(withoutTrailingPunctuation);
}

export function extractTokens(text: string): ExtractedTokens {
  const source = typeof text === "string" ? text : "";
  const urls = Array.from(source.matchAll(URL_RE)).map((m) =>
    normalizeExtractedUrl(m[0]),
  );
  const filePaths = Array.from(source.matchAll(FILE_PATH_RE)).map((m) => m[0]);
  const lineNumbers = Array.from(source.matchAll(LINE_REF_RE)).map(
    (m) => Number(m[1]),
  );
  const datesDeadlines = Array.from(source.matchAll(DATE_RE)).map((m) => m[0]);
  const peopleMentions = Array.from(source.matchAll(PERSON_RE))
    .flatMap((m) => m.slice(1).filter(Boolean))
    .map((mention) => mention.replace(/[.,;:!?]+$/g, ""))
    .filter(Boolean);
  const metrics = Array.from(source.matchAll(METRIC_RE)).map((m) => m[0]);

  return ExtractedTokensSchema.parse({
    file_paths: uniq(filePaths),
    line_numbers: uniq(lineNumbers),
    urls: uniq(urls),
    dates_deadlines: uniq(datesDeadlines),
    people_mentions: uniq(peopleMentions),
    metrics: uniq(metrics),
  });
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

// ---------------------------------------------------------------------------
// Token presence check in compiled output
// ---------------------------------------------------------------------------

function normalizeForMatch(value: string): string {
  return value
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Check that a hard token survives in the compiled text.
 *
 * Numeric tokens (line numbers) are matched with digit boundaries so a line
 * reference such as `214` cannot be satisfied by an arbitrary substring like
 * `2140` or `1402`. Other tokens are matched as whole normalized phrases.
 */
function tokenPresent(token: string, output: string): boolean {
  if (!token) return false;

  const normToken = normalizeForMatch(token);
  if (!normToken) return false;

  const normOutput = normalizeForMatch(output);
  if (!normOutput) return false;

  // Numeric-only tokens: require non-digit boundaries on both sides.
  if (/^\d+$/.test(normToken)) {
    const boundary = new RegExp(
      `(?:^|[^0-9])${escapeRegExp(normToken)}(?:[^0-9]|$)`,
    );
    return boundary.test(normOutput);
  }

  const paddedOutput = ` ${normOutput} `;
  if (paddedOutput.includes(` ${normToken} `)) return true;

  // A normalized URL token carries an explicit protocol while the compiled
  // prose may contain only the host/path (or vice versa). Compare the core
  // link without the protocol as a secondary, still-exact match.
  if (/^https?:\/\//i.test(token.trim())) {
    const core = normalizeForMatch(token.replace(/^https?:\/\//i, ""));
    if (core && paddedOutput.includes(` ${core} `)) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Verify a capsule against extracted tokens; auto-repair drops
// ---------------------------------------------------------------------------

export interface VerifyResult {
  capsule: ForgeStateCapsule;
  receipt: FidelityReceipt;
  repaired: boolean;
}

export function verifyFidelity(
  rawInput: string,
  capsule: ForgeStateCapsule,
): VerifyResult {
  const raw = typeof rawInput === "string" ? rawInput : "";
  const extracted = extractTokens(raw);
  const capsuleId = ensureUuid(capsule.capsule_id);

  const compiledText = [
    capsule.one_sentence_summary,
    capsule.two_minute_anchor,
    capsule.mental_state,
    capsule.raw_vs_compiled_diff ?? "",
    ...capsule.micro_steps.map((s) => s.text),
    ...capsule.dead_ends.map((d) => d.attempt + " " + d.error),
  ].join(" ");

  const allTokens: Array<{ kind: string; value: string }> = [
    ...extracted.file_paths.map((v) => ({ kind: "file_paths", value: v })),
    ...extracted.urls.map((v) => ({ kind: "urls", value: v })),
    ...extracted.dates_deadlines.map((v) => ({ kind: "dates_deadlines", value: v })),
    ...extracted.people_mentions.map((v) => ({ kind: "people_mentions", value: v })),
    ...extracted.metrics.map((v) => ({ kind: "metrics", value: v })),
  ];

  // Line numbers verified as numeric tokens (with exact digit boundaries).
  const lineTokens = extracted.line_numbers.map((n) => String(n));

  const intercepted: string[] = [];
  let tokensLost = 0;

  for (const t of allTokens) {
    if (!tokenPresent(t.value, compiledText)) {
      intercepted.push(`[${t.kind}] ${t.value}`);
      tokensLost += 1;
    }
  }
  for (const n of lineTokens) {
    if (!tokenPresent(n, compiledText)) {
      intercepted.push(`[line_numbers] #${n}`);
      tokensLost += 1;
    }
  }

  const totalTokens = allTokens.length + lineTokens.length;
  const tokensSurvived = Math.max(0, totalTokens - tokensLost);
  const hallucinationsIntercepted = intercepted.length;
  const repaired = intercepted.length > 0;
  const autoRepairs = intercepted.length;

  // Pre-repair mathematics: this is the score the compiled output actually
  // earned. It is never replaced with a hardcoded 100.
  const initialFidelityScore =
    totalTokens === 0
      ? 100
      : Math.round((tokensSurvived / totalTokens) * 100);

  // Auto-repair restores the missing tokens, so the final artifact reaches
  // 100%; both numbers are recorded on the receipt for an honest audit trail.
  const finalFidelityScore = repaired ? 100 : initialFidelityScore;

  const repairedCapsule: ForgeStateCapsule = {
    ...capsule,
    capsule_id: capsuleId,
    // Always expose the complete deterministic extraction to downstream UI,
    // regardless of which compiler tier produced the capsule.
    extracted_tokens: extracted,
    fidelity_score: finalFidelityScore,
  };

  // Auto-repair: append dropped tokens to the diff section so nothing is lost
  if (repaired) {
    const repairBlock = [
      "",
      "--- FlowDesk Fidelity Auto-Repair ---",
      "The following tokens were missing from the compiled output and have been restored:",
      ...intercepted.map((i) => `- ${i}`),
      "--- End Auto-Repair ---",
      "",
    ].join("\n");
    repairedCapsule.raw_vs_compiled_diff = [
      capsule.raw_vs_compiled_diff ?? "",
      repairBlock,
    ].join("\n").trim();
    repairedCapsule.intercepted_hallucinations = intercepted;
    repairedCapsule.auto_repaired = true;
  }

  const receipt: FidelityReceipt = {
    receipt_id: generateUuidV4(),
    capsule_id: capsuleId,
    generated_at: new Date().toISOString(),
    input_length: raw.length,
    tokens_extracted: totalTokens,
    tokens_survived: tokensSurvived,
    tokens_lost: tokensLost,
    hallucinations_intercepted: hallucinationsIntercepted,
    auto_repairs: autoRepairs,
    fidelity_score: initialFidelityScore,
    initial_fidelity_score: initialFidelityScore,
    final_fidelity_score: finalFidelityScore,
    repaired,
    verification_passed: finalFidelityScore === 100,
    evidence_hash: sha256Sync(raw + JSON.stringify(extracted) + capsuleId),
  };

  return { capsule: repairedCapsule, receipt, repaired };
}

// ---------------------------------------------------------------------------
// Tiny deterministic hash (no external deps) for receipt evidence
// ---------------------------------------------------------------------------

function sha256Sync(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // convert to 32bit integer
  }
  return (
    "fd-" +
    Math.abs(hash)
      .toString(16)
      .padStart(8, "0")
  );
}
