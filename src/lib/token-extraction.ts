/**
 * ForgeState — Shared Token Extraction Utilities
 * 
 * Single source of truth for all regex-based entity extraction.
 * Used by both fidelity-verifier.ts and deterministic-compiler.ts
 * to guarantee 100% consistent token detection.
 */

import { normalizeUrl } from "./flowdesk-contracts";

// ============================================================================
// REGEX PATTERNS (exported for testing & deterministic compiler reuse)
// ============================================================================

/**
 * URLs: http/https, www., and bare domain patterns with optional port/path
 * Trailing punctuation (.,;:!?)]}) is stripped in normalizeExtractedUrl()
 */
export const URL_RE =
  /https?:\/\/[^\s<>"'()]+|www\.[^\s<>"'()]+|(?<![\w@])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|org|net|io|dev|ai|app|co|uk|de|fr|jp|us|ca|au|nz|xyz|info|biz|me|tv|gg|so|sh|fm|site|online|tech|cloud|systems|tools)\b(?::\d{1,5})?(?:\/[^\s<>"'()]*)?/gi;

/**
 * File paths: relative (src/foo/bar.ts) and absolute (C:\path\file.ts)
 * Captures the path WITHOUT line/column suffixes — line numbers handled separately
 */
export const FILE_PATH_RE =
  /\b(?:[\w\-]+\/)+[\w\-]+\.\w{2,}(?:\?[^\s<>"'()]+)?|\b[a-zA-Z]:\\[\w\-.\\]+\.[\w]{2,}/g;

/**
 * File path with line:column suffix (IDE cursor positions, stack traces)
 * e.g., src/workers/payment-worker.ts:45 or app/page.tsx:120:4
 * Returns file path in group 1, line in group 2, optional column in group 3
 */
export const FILE_WITH_LINE_RE =
  /\b([a-zA-Z0-9_\-./\\]+\.(?:ts|tsx|js|jsx|py|rs|go|java|cs|rb|php|json|md|html|css|yaml|yml)):(\d+)(?::(\d+))?\b/g;

/**
 * Standalone line references: "line 302", "ln 45", "L302", "#214"
 */
export const LINE_REF_RE = /\b(?:line|ln|l)\s*#?:?\s*(\d{1,5})\b/gi;

/**
 * Date/deadline patterns — comprehensive coverage for real-world developer prose
 * 1. Day names + optional time/timezone: "Monday at 10:00 AM IST", "Friday 5pm EDT", "by Tuesday"
 * 2. Month + Day + optional Year: "November 3rd", "Oct 24, 2026", "24 Oct 2026"
 * 3. Relative time/deadlines: "before morning standup", "before the demo", "2 AM", "EOD", "tomorrow", "within 2 hours"
 * 4. ISO dates: 2026-10-24
 * 5. Slash dates: 10/24/2026, 24/10/26
 */
export const DATE_RE =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:,\s*\d{4})?|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2}|\b(?:mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm|[A-Z]{2,4})?)?(?:\s+(?:IST|EST|EDT|PST|PDT|GMT|UTC|CET|CEST))?\b|\b(?:by|before|within)\s+(?:morning\s+standup|the\s+demo|EOD|tomorrow|today|\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d+\s*hours?)\b|\b(?:2\s*AM|3\s*AM|4\s*AM|EOD)\b/gi;

/**
 * Person mentions:
 * - @handles with hyphens/slashes: @on-call, @ons-team, @ops-team, @sarah.lee
 * - Named actors in prose: "Sarah pushed", "Alex merged", "Marcus deployed", "Priya reported", "David assigned", "Chen reviewed"
 * - Client entities: "client Acme Corp", "client John Doe"
 */
export const PERSON_RE = 
  /(?:^|[\s(\[])@([A-Za-z0-9_-][A-Za-z0-9_.-]{1,30})|\b(?:by|with|for|from|to|ping)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})\b|\b([A-Z][a-z]+)\s*(?:\(@[A-Za-z0-9_.-]+\))?\s+(?:pushed|merged|deployed|reported|assigned|reviewed|said)\b|client\s+([A-Z][a-zA-Z0-9\s]+?(?=\s+(?:on|at|before|by|for|[.,;]|$)))/g;

/**
 * Metrics & technical identifiers:
 * - PR/Issue numbers: PR #312, #312, Issue #42
 * - HTTP status codes & error codes: 429, 500, 504, ECONNREFUSED, ETIMEDOUT, OOM
 * - Sizes/durations/counts: 50MB, 30 seconds, pool size 50, 50 req/s, 99.9%
 */
export const METRIC_RE = 
  /\b(?:PR|Issue|issue|issue)\s*#\d+|#\d+\b|\b\d{3}\b|\b(?:ECONNREFUSED|ETIMEDOUT|ENOENT|EACCES|OOM|ENOMEM|SIGKILL|SIGTERM|SIGSEGV)\b|\b\d+(?:\.\d+)?\s?(?:ms|s|sec|second|seconds|min|minute|minutes|hr|hour|hours|kb|mb|gb|tb|%|percent|req\/s|rps|kb\/s|mb\/s)\b|\bpool\s+size\s+\d+\b/gi;

// ============================================================================
// NORMALIZATION HELPERS
// ============================================================================

/**
 * Normalize a detected link into absolute https:// URL.
 * Strips trailing sentence punctuation (.,;:!?)]})
 */
export function normalizeExtractedUrl(raw: string): string {
  const withoutTrailingPunctuation = raw.replace(/[.,;:!?)\]}]+$/g, "");
  return normalizeUrl(withoutTrailingPunctuation);
}

/**
 * Normalize extracted date strings to ISO-8601 (YYYY-MM-DD) format.
 * Defaults to current year (2026) when year is omitted.
 * Handles: "October 24th", "Nov 3rd, 2026", "Monday at 10:00 AM IST", "EOD", "tomorrow"
 */
export function normalizeDateToISO(raw: string): string {
  const trimmed = raw.trim();
  
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // MM/DD/YYYY or MM/DD/YY or DD/MM/YYYY (ambiguous but we try)
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    let year = slashMatch[3];
    if (year.length === 2) year = "20" + year;
    return `${year}-${month}-${day}`;
  }
  
  // Month name formats: "October 24th", "October 24th, 2026", "Nov 3rd", etc.
  const monthNames: Record<string, string> = {
    jan: "01", january: "01",
    feb: "02", february: "02",
    mar: "03", march: "03",
    apr: "04", april: "04",
    may: "05",
    jun: "06", june: "06",
    jul: "07", july: "07",
    aug: "08", august: "08",
    sep: "09", sept: "09", september: "09",
    oct: "10", october: "10",
    nov: "11", november: "11",
    dec: "12", december: "12",
  };
  
  const monthMatch = trimmed.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?(?:,\s*(\d{4}))?$/i);
  if (monthMatch) {
    const month = monthNames[monthMatch[1].toLowerCase()];
    const day = monthMatch[2].padStart(2, "0");
    const year = monthMatch[3] || "2026";
    return `${year}-${month}-${day}`;
  }
  
  // Day name + optional time: "Monday at 10:00 AM IST", "Friday 5pm EDT", "by Tuesday"
  const dayNames: Record<string, string> = {
    mon: "monday", monday: "monday",
    tue: "tuesday", tuesday: "tuesday",
    wed: "wednesday", wednesday: "wednesday",
    thu: "thursday", thursday: "thursday",
    fri: "friday", friday: "friday",
    sat: "saturday", saturday: "saturday",
    sun: "sunday", sunday: "sunday",
  };
  
  const dayMatch = trimmed.match(/^(?:by|before|within)?\s*(mon|tue|wed|thu|fri|sat|sun)(?:day)?(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:am|pm|[A-Z]{2,4})?)?(?:\s+(?:IST|EST|EDT|PST|PDT|GMT|UTC|CET|CEST))?$/i);
  if (dayMatch) {
    // Return as-is for display; normalization to specific date requires context
    return trimmed;
  }
  
  // Relative deadlines: "before morning standup", "before the demo", "EOD", "tomorrow", "within 2 hours"
  const relativeMatch = trimmed.match(/^(?:by|before|within)\s+(?:morning\s+standup|the\s+demo|EOD|tomorrow|today|\d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d+\s*hours?)$/i);
  if (relativeMatch) {
    return trimmed;
  }
  
  // "2 AM", "EOD" standalone
  if (/^(?:2\s*AM|3\s*AM|4\s*AM|EOD)$/i.test(trimmed)) {
    return trimmed;
  }
  
  // Fallback: return original
  return trimmed;
}

/**
 * Extract file paths AND line numbers from file:line:col patterns.
 * Returns { filePaths: string[], lineNumbers: number[] }
 */
export function extractFilePathsWithLines(text: string): { filePaths: string[]; lineNumbers: number[] } {
  const filePaths: string[] = [];
  const lineNumbers: number[] = [];
  
  const matches = Array.from(text.matchAll(FILE_WITH_LINE_RE));
  for (const m of matches) {
    filePaths.push(m[1]);
    lineNumbers.push(parseInt(m[2], 10));
    // Column (m[3]) intentionally ignored for line_numbers
  }
  
  return { filePaths, lineNumbers };
}

/**
 * Extract standalone line references (not attached to file paths).
 * e.g., "line 302", "L45", "ln 120"
 */
export function extractStandaloneLineRefs(text: string): number[] {
  const lineNumbers: number[] = [];
  const matches = Array.from(text.matchAll(LINE_REF_RE));
  for (const m of matches) {
    lineNumbers.push(parseInt(m[1], 10));
  }
  return lineNumbers;
}

/**
 * Extract person mentions from @handles and prose patterns.
 */
export function extractPeopleMentions(text: string): string[] {
  const mentions: string[] = [];
  const matches = Array.from(text.matchAll(PERSON_RE));
  const ignoredNames = new Set([
    "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
    "january", "february", "march", "april", "may", "june", "july", "august",
    "september", "october", "november", "december",
    "today", "tomorrow", "yesterday", "eod", "morning", "standup", "demo"
  ]);
  for (const m of matches) {
    // m[1] = @handle, m[2] = preposition actor, m[3] = action actor, m[4] = client entity
    const mention = m[1] || m[2] || m[3] || m[4];
    if (mention) {
      const clean = mention.replace(/[.,;:!?]+$/g, "").trim();
      if (!ignoredNames.has(clean.toLowerCase())) {
        mentions.push(clean);
      }
    }
  }
  return mentions;
}

/**
 * Extract metrics from text.
 */
export function extractMetrics(text: string): string[] {
  const metrics: string[] = [];
  const matches = Array.from(text.matchAll(METRIC_RE));
  for (const m of matches) {
    metrics.push(m[0]);
  }
  return metrics;
}

// ============================================================================
// MAIN EXTRACTION FUNCTION (shared by verifier & deterministic compiler)
// ============================================================================

export interface ExtractedTokens {
  file_paths: string[];
  line_numbers: number[];
  urls: string[];
  dates_deadlines: string[];
  people_mentions: string[];
  metrics: string[];
}

export function extractTokensShared(text: string): ExtractedTokens {
  const source = typeof text === "string" ? text : "";
  
  // 1. File paths with line:col (src/foo.ts:45) — split into file + line
  const { filePaths: fileWithLinePaths, lineNumbers: fileWithLineNumbers } = extractFilePathsWithLines(source);
  
  // 2. Standalone file paths (without line suffixes)
  const standaloneFilePaths = Array.from(source.matchAll(FILE_PATH_RE)).map((m) => m[0]);
  
  // 3. Standalone line references ("line 302", "L45")
  const standaloneLineNumbers = extractStandaloneLineRefs(source);
  
  // 4. URLs
  const urls = Array.from(source.matchAll(URL_RE)).map((m) =>
    normalizeExtractedUrl(m[0]),
  );
  
  // 5. Dates/deadlines (normalized to ISO where possible)
  const datesDeadlines = Array.from(source.matchAll(DATE_RE))
    .map((m) => normalizeDateToISO(m[0]));
  
  // 6. People mentions
  const peopleMentions = extractPeopleMentions(source);
  
  // 7. Metrics
  const metrics = extractMetrics(source);
  
  // Deduplicate
  const uniq = <T>(arr: T[]): T[] => Array.from(new Set(arr));
  
  return {
    file_paths: uniq([...standaloneFilePaths, ...fileWithLinePaths]),
    line_numbers: uniq([...standaloneLineNumbers, ...fileWithLineNumbers]),
    urls: uniq(urls),
    dates_deadlines: uniq(datesDeadlines),
    people_mentions: uniq(peopleMentions),
    metrics: uniq(metrics),
  };
}