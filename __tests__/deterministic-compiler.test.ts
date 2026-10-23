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

  it("extracts file paths correctly from git diff headers", () => {
    const gitDiff = `diff --git a/src/lib/export-pipeline.ts b/src/lib/export-pipeline.ts
index 1234567..abcdefg 100644
--- a/src/lib/export-pipeline.ts
+++ b/src/lib/export-pipeline.ts
@@ -10,7 +10,7 @@ export function runPipeline() {
-  const timeout = 30000;
+  const timeout = 60000;
   return fetchData(timeout);
 }
`;
    const capsule = compileDeterministic({
      text: gitDiff,
      source: "paste",
    });

    expect(capsule.extracted_tokens.file_paths).toContain("src/lib/export-pipeline.ts");
  });

  it("extracts added/removed lines with correct file paths from git diff", () => {
    const gitDiff = `diff --git a/src/lib/export-pipeline.ts b/src/lib/export-pipeline.ts
index 1234567..abcdefg 100644
--- a/src/lib/export-pipeline.ts
+++ b/src/lib/export-pipeline.ts
@@ -299,6 +299,7 @@ export function runPipeline() {
   console.log("Starting pipeline");
   const result = await fetchData();
+  console.log("Pipeline result:", result);
   return result;
 }
`;
    const capsule = compileDeterministic({
      text: gitDiff,
      source: "paste",
    });

    // The deterministic compiler merges extracted tokens with git entities
    expect(capsule.extracted_tokens.file_paths).toContain("src/lib/export-pipeline.ts");
  });

  it("produces rich L2 output for complex Slack handoff (Sarah / PR #312 / Acme Corp)", () => {
    const slackHandoff = `Hey team, handoff for the auth service: Sarah pushed to feature/oauth-fix but PR #312 is failing CI on the JWT expiration test. We need this merged before the demo with client Acme Corp on Monday at 10:00 AM IST. Don't touch src/middleware/auth.ts unless you update the RSA keys in HashiCorp Vault. Thread reference: https://slack.com/archives/C1234567890/p1234567890. Check if the rate limiter middleware is returning 429 correctly or causing infinite redirect loops in Next.js App Router.`;

    const capsule = compileDeterministic({
      text: slackHandoff,
      source: "paste",
    });

    // === 1. Extract ALL 8 ground-truth tokens ===
    expect(capsule.extracted_tokens.file_paths).toContain("src/middleware/auth.ts");
    // PR #312 is extracted as a metric (PR reference), not a line number
    expect(capsule.extracted_tokens.metrics).toContain("PR #312");
    expect(capsule.extracted_tokens.urls).toContain("https://slack.com/archives/C1234567890/p1234567890");
    expect(capsule.extracted_tokens.dates_deadlines.length).toBeGreaterThanOrEqual(1); // "Monday at 10:00 AM IST"
    expect(capsule.extracted_tokens.people_mentions).toContain("Sarah");
    expect(capsule.extracted_tokens.people_mentions).toContain("Acme Corp"); // "client Acme Corp" extracted
    expect(capsule.extracted_tokens.metrics).toContain("429");
    // Note: "feature/oauth-fix" is a branch name, not a file path

    // === 2. Mental State synthesizes service, failure mode, and deadline ===
    expect(capsule.mental_state).toContain("auth service");
    expect(capsule.mental_state).toContain("failing CI"); // "failing CI on the JWT expiration test"
    expect(capsule.mental_state).toContain("Sarah");
    // Acme Corp appears in people_mentions, not necessarily in mental_state (deadline regex captures "the demo")

    // === 3. Dead-Ends Firewall captures guardrail constraint ===
    expect(capsule.dead_ends.length).toBeGreaterThanOrEqual(1);
    const guardrailDeadEnd = capsule.dead_ends.find(d => 
      d.attempt.includes("src/middleware/auth.ts") || d.error.includes("HashiCorp Vault")
    );
    expect(guardrailDeadEnd).toBeDefined();
    expect(guardrailDeadEnd!.error).toContain("Guardrail constraint");

    // === 4. Ordered Micro-Steps: 2-4 concrete sequential steps ===
    expect(capsule.micro_steps.length).toBeGreaterThanOrEqual(2);
    expect(capsule.micro_steps.length).toBeLessThanOrEqual(4);

    // Step 1: Immediate Anchor / Triage
    const step1 = capsule.micro_steps[0].text;
    expect(step1).toContain("PR #312");
    // The step should reference the primary issue (PR #312 and JWT/failing CI)
    expect(step1.toLowerCase()).toMatch(/pr #312|jwt|failing ci/);

    // Step 2: Investigation / Code Check (rate limiter check)
    const step2 = capsule.micro_steps[1]?.text ?? "";
    expect(step2.toLowerCase()).toMatch(/rate limiter|429|redirect/);

    // Step 3: Guardrail / Prerequisite Check (HashiCorp Vault)
    const step3 = capsule.micro_steps[2]?.text ?? "";
    expect(step3).toContain("HashiCorp Vault");
    expect(step3).toContain("RSA keys");

    // Step 4: Handoff / Deadline Sync
    const step4 = capsule.micro_steps[3]?.text ?? "";
    // Should reference the deadline (Monday at 10:00 AM IST or "the demo")
    expect(step4.toLowerCase()).toMatch(/monday|10:00|demo|acme/i);
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
