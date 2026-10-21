import { describe, expect, it } from "vitest";
import { extractTokens, verifyFidelity } from "@/lib/fidelity-verifier";
import type { ForgeStateCapsule } from "@/lib/flowdesk-contracts";

const baseCapsule: ForgeStateCapsule = {
  capsule_id: "00000000-0000-4000-8000-000000000010",
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

describe("verifyFidelity scoring", () => {
  it("reports the real pre-repair survival ratio on the receipt", () => {
    const raw =
      "Open src/pages/checkout.tsx at line 214, not line 21.";
    const capsule: ForgeStateCapsule = {
      ...baseCapsule,
      one_sentence_summary:
        "Open src/pages/checkout.tsx at line 214.",
      two_minute_anchor: "Read the failing function.",
      mental_state: "Focused",
    };

    const { capsule: repaired, receipt, repaired: wasRepaired } =
      verifyFidelity(raw, capsule);

    expect(receipt.tokens_extracted).toBe(3);
    expect(receipt.tokens_survived).toBe(2);
    expect(receipt.tokens_lost).toBe(1);
    expect(receipt.fidelity_score).toBe(
      Math.round((receipt.tokens_survived / receipt.tokens_extracted) * 100),
    );
    expect(receipt.fidelity_score).toBe(67);
    expect(receipt.initial_fidelity_score).toBe(67);
    expect(receipt.final_fidelity_score).toBe(100);
    expect(receipt.repaired).toBe(true);
    expect(wasRepaired).toBe(true);

    // The repaired artifact reaches 100%, but the audit trail keeps both
    // numbers rather than erasing the initial score.
    expect(repaired.fidelity_score).toBe(100);
    expect(repaired.auto_repaired).toBe(true);
  });

  it("does not match arbitrary numerical substrings for line tokens", () => {
    const raw = "Look at line 21.";
    const capsule: ForgeStateCapsule = {
      ...baseCapsule,
      one_sentence_summary: "The bug is on line 214.",
      two_minute_anchor: "Open line 2140.",
      mental_state: "Focused",
    };

    const { receipt } = verifyFidelity(raw, capsule);

    expect(receipt.tokens_extracted).toBe(1);
    expect(receipt.tokens_lost).toBe(1);
    expect(receipt.fidelity_score).toBe(0);
  });

  it("always forwards the complete deterministic token set to the capsule", () => {
    const raw =
      "Fix src/lib/api.ts line 42 and ping @maya. See www.example.com/docs by Friday.";
    const capsule: ForgeStateCapsule = {
      ...baseCapsule,
      one_sentence_summary: "Something is broken.",
      two_minute_anchor: "Reproduce it.",
      mental_state: "Blocked",
    };

    const { capsule: repaired } = verifyFidelity(raw, capsule);
    const extracted = extractTokens(raw);

    expect(repaired.extracted_tokens).toEqual(extracted);
    expect(repaired.extracted_tokens.file_paths).toContain("src/lib/api.ts");
    expect(repaired.extracted_tokens.urls).toContain(
      "https://www.example.com/docs",
    );
    expect(repaired.extracted_tokens.people_mentions).toContain("maya");
  });

  it("keeps 100% for empty input with no hard tokens", () => {
    const { receipt, capsule: repairedCapsule } = verifyFidelity(
      "",
      baseCapsule,
    );
    expect(receipt.tokens_extracted).toBe(0);
    expect(receipt.fidelity_score).toBe(100);
    expect(receipt.repaired).toBe(false);
    expect(repairedCapsule.extracted_tokens.urls).toEqual([]);
  });

  it("matches normalized links with or without an explicit protocol", () => {
    const raw = "Open www.example.com/path before the review.";
    const capsule: ForgeStateCapsule = {
      ...baseCapsule,
      one_sentence_summary: "Open https://www.example.com/path.",
      two_minute_anchor: "Check the page.",
      mental_state: "Focused",
    };

    const { receipt } = verifyFidelity(raw, capsule);
    expect(receipt.tokens_extracted).toBe(1);
    expect(receipt.tokens_lost).toBe(0);
    expect(receipt.fidelity_score).toBe(100);
  });
});
