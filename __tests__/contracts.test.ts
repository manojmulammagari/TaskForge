import { describe, it, expect } from "vitest";
import {
  DeadEndEntrySchema,
  ExtractedTokensSchema,
  MicroStepSchema,
  validateCapsule,
  validateDispatchReceipt,
  validateDispatchRequest,
  validateReceipt,
  validateSessionEvidence,
  type ForgeStateCapsule,
} from "@/lib/flowdesk-contracts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const baseCapsule: ForgeStateCapsule = {
  capsule_id: "00000000-0000-4000-8000-000000000001",
  created_at: "2026-10-20T02:00:00.000Z",
  source_input: "Fix the login form",
  source_type: "text",
  one_sentence_summary: "Fix the login form.",
  two_minute_anchor: "Open the login form.",
  mental_state: "Focused",
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

const baseReceipt = {
  receipt_id: "00000000-0000-4000-8000-000000000002",
  capsule_id: "00000000-0000-4000-8000-000000000001",
  generated_at: "2026-10-20T02:00:00.000Z",
  input_length: 10,
  tokens_extracted: 0,
  tokens_survived: 0,
  tokens_lost: 0,
  hallucinations_intercepted: 0,
  auto_repairs: 0,
  fidelity_score: 100,
  verification_passed: true,
  evidence_hash: "fd-12345678",
};

describe("ExtractedTokensSchema URLs", () => {
  it("accepts protocol-less www links and normalizes them", () => {
    const parsed = ExtractedTokensSchema.parse({ urls: ["www.domain.com"] });
    expect(parsed.urls).toEqual(["https://www.domain.com"]);
  });

  it("accepts fully qualified URLs unchanged", () => {
    const parsed = ExtractedTokensSchema.parse({
      urls: ["https://api.example.com/webhook"],
    });
    expect(parsed.urls).toEqual(["https://api.example.com/webhook"]);
  });

  it("accepts bare domains with paths", () => {
    const parsed = ExtractedTokensSchema.parse({
      urls: ["example.com/path?q=1"],
    });
    expect(parsed.urls).toEqual(["https://example.com/path?q=1"]);
  });

  it("still rejects non-URL strings", () => {
    expect(() =>
      ExtractedTokensSchema.parse({ urls: ["not a url at all"] }),
    ).toThrow();
  });
});

describe("resilient ID schemas", () => {
  it("preserves standard UUIDs", () => {
    const parsed = validateCapsule({ ...baseCapsule });
    expect(parsed.capsule_id).toBe(baseCapsule.capsule_id);
  });

  it("deterministically migrates legacy capsule IDs", () => {
    const first = validateCapsule({
      ...baseCapsule,
      capsule_id: "capsule-1729380000000",
    });
    const second = validateCapsule({
      ...baseCapsule,
      capsule_id: "capsule-1729380000000",
    });

    expect(first.capsule_id).toMatch(UUID_RE);
    expect(second.capsule_id).toBe(first.capsule_id);
  });

  it("migrates legacy receipt and dispatch IDs", () => {
    const receipt = validateReceipt({
      ...baseReceipt,
      receipt_id: "receipt-legacy",
      capsule_id: "capsule-legacy",
    });
    expect(receipt.receipt_id).toMatch(UUID_RE);
    expect(receipt.capsule_id).toMatch(UUID_RE);

    const request = validateDispatchRequest({
      capsule_id: "capsule-legacy",
      target: "github",
      payload: {},
      sandbox: true,
    });
    expect(request.capsule_id).toMatch(UUID_RE);

    const dispatchReceipt = validateDispatchReceipt({
      request_id: "request-legacy",
      capsule_id: "capsule-legacy",
      target: "github",
      executed_at: "2026-10-20T02:00:00.000Z",
      sandbox: true,
      success: true,
      execution_log: [],
    });
    expect(dispatchReceipt.request_id).toMatch(UUID_RE);
    expect(dispatchReceipt.capsule_id).toMatch(UUID_RE);
  });

  it("migrates legacy session IDs in evidence envelopes", () => {
    const envelope = {
      session_id: "session-legacy",
      created_at: "2026-10-20T02:00:00.000Z",
      raw_input: { text: "Fix the login form", source: "text" },
      capsule: baseCapsule,
      receipt: baseReceipt,
      verification_passed: true,
    };

    const first = validateSessionEvidence(envelope);
    const second = validateSessionEvidence(envelope);

    expect(first.session_id).toMatch(UUID_RE);
    expect(second.session_id).toBe(first.session_id);
  });
});

describe("LLM output sanitization", () => {
  it("replaces empty dead-end fields with readable fallbacks", () => {
    const parsed = DeadEndEntrySchema.parse({
      id: "",
      attempt: "",
      error: "",
      tried_at: "",
    });
    expect(parsed.id.length).toBeGreaterThan(0);
    expect(parsed.attempt.length).toBeGreaterThan(0);
    expect(parsed.error.length).toBeGreaterThan(0);
    expect(parsed.tried_at).toBeUndefined();
  });

  it("rounds floating-point durations and replaces empty step text", () => {
    const parsed = MicroStepSchema.parse({
      id: "step-1",
      text: "",
      duration_min: 2.7,
    });
    expect(parsed.text.length).toBeGreaterThan(0);
    expect(parsed.duration_min).toBe(3);
    expect(Number.isInteger(parsed.duration_min)).toBe(true);
  });

  it("defaults missing durations to two minutes", () => {
    const parsed = MicroStepSchema.parse({
      id: "step-1",
      text: "Open the file",
      duration_min: undefined,
    });
    expect(parsed.duration_min).toBe(2);
  });
});
