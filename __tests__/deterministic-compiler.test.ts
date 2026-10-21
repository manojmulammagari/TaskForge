import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compileDeterministic,
  compileRawInput,
} from "@/lib/deterministic-compiler";
import { generateUuidV4, isUuid } from "@/lib/uuid";

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("compileDeterministic", () => {
  it("always returns a valid UUID capsule id", () => {
    const capsule = compileDeterministic({
      text: "Fix src/pages/checkout.tsx line 214.",
      source: "text",
    });
    expect(capsule.capsule_id).toMatch(UUID_V4_RE);
  });

  it("mints a compliant UUID v4 when Web Crypto is unavailable", () => {
    vi.stubGlobal("crypto", undefined);

    const capsule = compileDeterministic({
      text: "Fix the broken checkout redirect.",
      source: "text",
    });

    expect(capsule.capsule_id).toMatch(UUID_V4_RE);
    expect(isUuid(capsule.capsule_id)).toBe(true);
    expect(generateUuidV4()).toMatch(UUID_V4_RE);
  });

  it("normalizes protocol-less links into the contract URL shape", () => {
    const capsule = compileDeterministic({
      text: "POST the payload to www.stripe.com/webhook before Friday.",
      source: "paste",
    });

    expect(capsule.extracted_tokens.urls).toContain(
      "https://www.stripe.com/webhook",
    );
  });

  it("also recognizes bare domains without www", () => {
    const capsule = compileDeterministic({
      text: "Check example.com/docs and ping the owner before Friday.",
      source: "text",
    });

    expect(capsule.extracted_tokens.urls).toContain(
      "https://example.com/docs",
    );
  });

  it("preserves hard tokens in the compiled capsule", () => {
    const capsule = compileDeterministic({
      text: "Fix src/pages/checkout.tsx line 214 before October 24th. Ping @sarah.lee. Timeout is 30s.",
      source: "voice",
    });

    expect(capsule.extracted_tokens.file_paths).toContain(
      "src/pages/checkout.tsx",
    );
    expect(capsule.extracted_tokens.line_numbers).toContain(214);
    expect(capsule.extracted_tokens.people_mentions).toContain("sarah.lee");
    expect(capsule.extracted_tokens.metrics.length).toBeGreaterThan(0);
    expect(capsule.one_sentence_summary.length).toBeGreaterThan(0);
    expect(capsule.two_minute_anchor.length).toBeGreaterThan(0);
  });

  it("never crashes on empty input", () => {
    const capsule = compileDeterministic({ text: "", source: "text" });
    expect(capsule.one_sentence_summary.length).toBeGreaterThan(0);
    expect(capsule.two_minute_anchor.length).toBeGreaterThan(0);
    expect(capsule.dead_ends.length).toBeGreaterThan(0);
    expect(capsule.micro_steps.length).toBeGreaterThan(0);
    expect(capsule.extracted_tokens.urls).toEqual([]);
  });
});

describe("compileRawInput", () => {
  it("coerces malformed legacy payloads instead of throwing", () => {
    const capsule = compileRawInput({ nonsense: true });
    expect(isUuid(capsule.capsule_id)).toBe(true);
    expect(capsule.source_type).toBe("text");
    expect(capsule.source_input.length).toBeGreaterThan(0);
  });

  it("accepts a normal RawInput", () => {
    const capsule = compileRawInput({ text: "Check the build.", source: "paste" });
    expect(capsule.source_type).toBe("paste");
  });
});
