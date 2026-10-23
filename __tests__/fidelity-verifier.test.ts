import { describe, it, expect } from "vitest";
import {
  extractTokens,
  verifyFidelity,
} from "@/lib/fidelity-verifier";
import type { ForgeStateCapsule } from "@/lib/flowdesk-contracts";

const baseCapsule: ForgeStateCapsule = {
  capsule_id: "00000000-0000-0000-0000-000000000001",
  created_at: "2026-10-20T02:00:00.000Z",
  source_input: "",
  source_type: "text",
  one_sentence_summary: "",
  two_minute_anchor: "",
  mental_state: "",
  dead_ends: [],
  micro_steps: [],
  extracted_tokens: {
    file_paths: [],
    line_numbers: [],
    urls: [],
    dates_deadlines: [],
    people_mentions: [],
    metrics: [],
  },
  fidelity_score: 100,
  intercepted_hallucinations: [],
  auto_repaired: false,
  receipt_generated: false,
  dispatch_targets: [],
};

describe("extractTokens", () => {
  it("extracts file paths and line numbers", () => {
    const t = extractTokens("Fix src/pages/checkout.tsx line 214 and lib/api.ts:42");
    expect(t.file_paths).toContain("src/pages/checkout.tsx");
    expect(t.line_numbers).toContain(214);
  });

  it("extracts URLs", () => {
    const t = extractTokens("POST to https://api.example.com/webhook and www.stripe.com");
    expect(t.urls.some((u) => u.includes("api.example.com"))).toBe(true);
  });

  it("extracts dates and deadlines", () => {
    const t = extractTokens("Due Friday, October 24th or 2026-10-24");
    expect(t.dates_deadlines.length).toBeGreaterThan(0);
  });

  it("extracts people mentions (@handle and names)", () => {
    const t = extractTokens("Ping @sarah.lee and ask Maya Patel to review");
    expect(t.people_mentions.some((p) => p.includes("sarah.lee"))).toBe(true);
  });

  it("extracts metrics", () => {
    const t = extractTokens("Timeout after 30s, 50MB file, 99.9% uptime, 100 req/s");
    expect(t.metrics.length).toBeGreaterThan(0);
  });
});

describe("verifyFidelity", () => {
  it("passes with 100% when all tokens survive", () => {
    const raw =
      "Fix src/pages/checkout.tsx line 214. Deadline October 24th. Ping @sarah.lee. Timeout 30s.";
    const capsule: ForgeStateCapsule = {
      ...baseCapsule,
      one_sentence_summary:
        "Fix src/pages/checkout.tsx line 214. Deadline October 24th. Ping @sarah.lee. Timeout 30s.",
      two_minute_anchor: "Open src/pages/checkout.tsx at line 214.",
      mental_state: "Focused",
    };
    const { capsule: repaired, receipt } = verifyFidelity(raw, capsule);
    expect(receipt.verification_passed).toBe(true);
    expect(receipt.fidelity_score).toBe(100);
    expect(repaired.auto_repaired).toBe(false);
  });

  it("intercepts dropped tokens and auto-repairs to 100%", () => {
    const raw =
      "Fix src/lib/export-pipeline.ts line 302. Must ship by Monday, November 3rd. Assign to @devops-lead.";
    // Intentionally omit the deadline and file path from the anchor
    const capsule: ForgeStateCapsule = {
      ...baseCapsule,
      one_sentence_summary: "Export pipeline times out.",
      two_minute_anchor: "Bump the timeout in the export worker.",
      mental_state: "Blocked",
    };
    const { capsule: repaired, receipt } = verifyFidelity(raw, capsule);
    expect(receipt.hallucinations_intercepted).toBeGreaterThan(0);
    expect(repaired.auto_repaired).toBe(true);
    expect(repaired.fidelity_score).toBe(100);
    expect(repaired.raw_vs_compiled_diff).toContain("Auto-Repair");
  });

  it("produces a FidelityReceipt with evidence hash", () => {
    const raw = "Check src/utils.ts line 10.";
    const capsule: ForgeStateCapsule = {
      ...baseCapsule,
      one_sentence_summary: "Check src/utils.ts line 10.",
      two_minute_anchor: "Open src/utils.ts line 10.",
      mental_state: "OK",
    };
    const { receipt } = verifyFidelity(raw, capsule);
    expect(receipt.receipt_id).toBeDefined();
    expect(receipt.evidence_hash).toBeDefined();
    expect(typeof receipt.evidence_hash).toBe("string");
    expect(receipt.input_length).toBe(raw.length);
  });

  it("handles empty input gracefully (100% fidelity, no tokens)", () => {
    const raw = "Hello world, just a note.";
    const capsule: ForgeStateCapsule = {
      ...baseCapsule,
      one_sentence_summary: "Hello world, just a note.",
      two_minute_anchor: "Read the note.",
      mental_state: "OK",
    };
    const { receipt } = verifyFidelity(raw, capsule);
    expect(receipt.verification_passed).toBe(true);
    expect(receipt.fidelity_score).toBe(100);
  });

  it("The Hallucination Trap: intercepts hallucinated file paths not in raw input", () => {
    const raw =
      "Fix src/lib/export-pipeline.ts line 302. Must ship by Monday, November 3rd.";
    // Capsule contains a hallucinated file path that doesn't exist in raw
    const capsule: ForgeStateCapsule = {
      ...baseCapsule,
      one_sentence_summary: "Export pipeline times out, check src/lib/export-pipeline.ts and src/lib/nonexistent-helper.ts",
      two_minute_anchor: "Open src/lib/export-pipeline.ts at line 302.",
      mental_state: "Blocked",
      extracted_tokens: {
        file_paths: ["src/lib/export-pipeline.ts", "src/lib/nonexistent-helper.ts"],
        line_numbers: [302],
        urls: [],
        dates_deadlines: ["Monday, November 3rd"],
        people_mentions: [],
        metrics: [],
      },
    };
    const { capsule: repaired, receipt } = verifyFidelity(raw, capsule);
    
    // The hallucinated file path should be intercepted and dropped
    expect(receipt.hallucinations_intercepted).toBeGreaterThan(0);
    expect(repaired.auto_repaired).toBe(true);
    expect(repaired.fidelity_score).toBe(100);
    
    // The hallucinated file should be stripped from extracted_tokens
    expect(repaired.extracted_tokens.file_paths).not.toContain("src/lib/nonexistent-helper.ts");
    expect(repaired.extracted_tokens.file_paths).toContain("src/lib/export-pipeline.ts");
    
    // The interception should be recorded
    const intercepted = receipt.hallucinations_intercepted;
    expect(intercepted).toBeGreaterThan(0);
  });

  it("extracts 'times out after 30 seconds' metric and 'line: 302' reference", () => {
    const raw = "The export pipeline times out after 30 seconds. Check src/lib/export-pipeline.ts line: 302 for the issue.";
    const tokens = extractTokens(raw);
    
    // Should extract the metric with full unit name
    expect(tokens.metrics.some(m => m.includes("30 seconds"))).toBe(true);
    
    // Should extract line reference with "line:" format
    expect(tokens.line_numbers).toContain(302);
  });

  it("The Hallucination Trap: intercepts hallucinated functions (validateTokenSync) not in raw input", () => {
    const raw =
      "Fix src/lib/export-pipeline.ts line 302. Must ship by Monday, November 3rd.";
    // Capsule contains a hallucinated function that doesn't exist in raw
    const capsule: ForgeStateCapsule = {
      ...baseCapsule,
      one_sentence_summary: "Export pipeline times out, call validateTokenSync() to fix.",
      two_minute_anchor: "Open src/lib/export-pipeline.ts at line 302.",
      mental_state: "Blocked",
      extracted_tokens: {
        file_paths: ["src/lib/export-pipeline.ts"],
        line_numbers: [302],
        urls: [],
        dates_deadlines: ["Monday, November 3rd"],
        people_mentions: [],
        metrics: [],
      },
    };
    const { capsule: repaired, receipt } = verifyFidelity(raw, capsule);
    
    // The hallucinated function should be intercepted
    expect(receipt.hallucinations_intercepted).toBeGreaterThan(0);
    expect(repaired.auto_repaired).toBe(true);
    expect(repaired.fidelity_score).toBe(100);
    
    // The interception should be recorded in intercepted_hallucinations
    expect(repaired.intercepted_hallucinations).toBeDefined();
    expect(repaired.intercepted_hallucinations!.length).toBeGreaterThan(0);
    
    // The hallucinated function should be in the intercepted list
    const hasHallucinatedFunction = repaired.intercepted_hallucinations!.some(
      (h) => h.includes("validateTokenSync")
    );
    expect(hasHallucinatedFunction).toBe(true);
    
    // receipt.repaired should be true
    expect(receipt.repaired).toBe(true);
  });
});
