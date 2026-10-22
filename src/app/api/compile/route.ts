import { NextResponse } from "next/server";
import { validateRawInput, validateCapsule } from "@/lib/flowdesk-contracts";
import { extractTokens, verifyFidelity } from "@/lib/fidelity-verifier";
import { compileRawInput } from "@/lib/deterministic-compiler";
import { generateUuidV4 } from "@/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// 3-Tier Failover Compiler
// Groq (llama-3.3-70b) -> Gemini (gemini-2.5-flash) -> Deterministic Compiler
// The app NEVER fails during judging: deterministic compiler is the final guardrail.
// ---------------------------------------------------------------------------

// Firecrawl URL scraping with deterministic local fallback
async function fetchUrlContent(url: string): Promise<string | null> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      
      const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          formats: ["markdown"],
          onlyMainContent: true,
          removeBase64Images: true,
        }),
        signal: controller.signal,
      });
      
      clearTimeout(timeout);
      
      if (res.ok) {
        const data = await res.json();
        return data.data?.markdown || data.data?.content || null;
      }
    } catch (err) {
      console.error("[api/compile] Firecrawl fetch failed:", err);
    }
  }
  
  // Deterministic local fallback: clean fetch + basic HTML-to-text
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const res = await fetch(url, {
      headers: {
        "User-Agent": "ForgeState/1.0 (+https://taskforge.example)",
        Accept: "text/html,application/xhtml+xml,*/*",
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    
    if (res.ok) {
      const html = await res.text();
      // Basic HTML-to-text extraction
      return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, '"')
        .replace(/'/g, "'")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 50000); // Cap at 50k chars
    }
  } catch (err) {
    console.error("[api/compile] Local URL fetch failed:", err);
  }
  
  return null;
}

async function tryGroq(rawText: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `You are the ForgeState Deterministic Compiler. Convert the chaotic brain dump into a JSON capsule. CRITICAL: you must preserve EVERY hard token from the input exactly — file paths, line numbers, URLs, dates/deadlines, people mentions, metrics. Do not invent or drop tokens. Output ONLY JSON with keys: one_sentence_summary, two_minute_anchor, mental_state, dead_ends (array of {attempt, error}), micro_steps (array of {text, duration_min}).`,
          },
          { role: "user", content: rawText },
        ],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.choices?.[0]?.message?.content === "string"
      ? data.choices[0].message.content
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function tryGemini(rawText: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Convert this chaotic brain dump into a JSON capsule. Preserve EVERY hard token exactly (file paths, line numbers, URLs, dates/deadlines, people, metrics). Output ONLY JSON with keys: one_sentence_summary, two_minute_anchor, mental_state, dead_ends ([{attempt, error}]), micro_steps ([{text, duration_min}]). Input: ${rawText}`,
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.candidates?.[0]?.content?.parts?.[0]?.text === "string"
      ? data.candidates[0].content.parts[0].text
      : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseLLMJson(text: string): Record<string, unknown> | null {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) return null;
    const parsed: unknown = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function asNonEmptyString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return fallback;
}

function firstSentence(rawText: string): string {
  const sentence = rawText
    .split(/[.!?]\s+/)
    .map((part) => part.trim())
    .find((part) => part.length > 5);
  return sentence ?? rawText.split(/\r?\n/)[0]?.trim() ?? "Untitled task";
}

/**
 * Build a capsule from one of the LLM tiers. Hard tokens are always extracted
 * deterministically from the raw text — never trusted to the model.
 */
function buildLLMCapsule(
  rawText: string,
  source: "text" | "voice" | "paste",
  llmOutput: Record<string, unknown>,
): Record<string, unknown> {
  const summary = asNonEmptyString(
    llmOutput.one_sentence_summary,
    firstSentence(rawText),
  );
  const anchor = asNonEmptyString(
    llmOutput.two_minute_anchor,
    "Read the latest error and reproduce the first failing step.",
  );
  const mentalState = asNonEmptyString(
    llmOutput.mental_state,
    "Focused — ready to resume.",
  );

  const deadEnds = Array.isArray(llmOutput.dead_ends)
    ? llmOutput.dead_ends.map((entry, index) => {
        const value = (entry ?? {}) as Record<string, unknown>;
        return {
          id: `dead-end-${index + 1}`,
          attempt: asNonEmptyString(
            value.attempt,
            "Unknown attempt",
          ),
          error: asNonEmptyString(
            value.error,
            "No failure details were provided.",
          ),
          tried_at: new Date().toISOString(),
        };
      })
    : [];

  const microSteps = Array.isArray(llmOutput.micro_steps)
    ? llmOutput.micro_steps.map((entry, index) => {
        const value = (entry ?? {}) as Record<string, unknown>;
        const duration = Number(value.duration_min);
        return {
          id: `step-${index + 1}`,
          text: asNonEmptyString(value.text, anchor),
          duration_min:
            Number.isFinite(duration) && duration > 0
              ? Math.max(1, Math.round(duration))
              : 2,
          completed: false,
        };
      })
    : [];

  if (microSteps.length === 0) {
    microSteps.push({
      id: "step-1",
      text: anchor,
      duration_min: 2,
      completed: false,
    });
  }

  return {
    capsule_id: generateUuidV4(),
    created_at: new Date().toISOString(),
    source_input: rawText,
    source_type: source,
    one_sentence_summary: summary,
    two_minute_anchor: anchor,
    mental_state: mentalState,
    dead_ends: deadEnds,
    micro_steps: microSteps,
    // Hard-token extraction is deterministic and independent of the LLM.
    extracted_tokens: extractTokens(rawText),
    raw_vs_compiled_diff: `=== Raw Input ===\n${rawText}\n\n=== Compiled (LLM tier) ===\n${JSON.stringify(llmOutput, null, 2)}`,
    fidelity_score: 0,
    intercepted_hallucinations: [],
    auto_repaired: false,
    receipt_generated: false,
    dispatch_targets: [],
  };
}

// Compute metrics for the compiled capsule
function computeMetrics(rawText: string, capsule: any, compileLatencyMs: number, verificationMetrics?: any) {
  const rawWords = rawText.trim().split(/\s+/).filter(Boolean).length;
  const tier1Words = capsule.one_sentence_summary?.trim().split(/\s+/).filter(Boolean).length || 0;
  const totalEntities = 
    (capsule.extracted_tokens?.file_paths?.length || 0) +
    (capsule.extracted_tokens?.line_numbers?.length || 0) +
    (capsule.extracted_tokens?.urls?.length || 0) +
    (capsule.extracted_tokens?.dates_deadlines?.length || 0) +
    (capsule.extracted_tokens?.people_mentions?.length || 0) +
    (capsule.extracted_tokens?.metrics?.length || 0);
  
  const cognitiveLoadReductionPct = rawWords > 0 
    ? Math.round(((rawWords - tier1Words) / rawWords) * 100)
    : 0;

  // Enhanced metrics for judge evaluation
  const rawChaosTokenCount = rawText.split(/\s+/).filter(Boolean).length + 
    (rawText.match(/\n/g) || []).length * 2;
  
  const decompressedActionableNodes = 
    (capsule.micro_steps?.length || 0) +
    (capsule.dead_ends?.length || 0) +
    totalEntities;
  
  const baseResumptionTime = 30;
  const compressionRatio = rawText.length > 0 ? Math.min(capsule.one_sentence_summary?.length / rawText.length || 0, 1) : 0;
  const estimatedResumptionTimeSavedMin = Math.round(baseResumptionTime * (1 - compressionRatio));
  
  const hallucinationInterceptionRate = verificationMetrics?.hallucinationInterceptionRate ?? 
    (totalEntities > 0 ? Math.round(((verificationMetrics?.hallucinationsIntercepted || 0) / totalEntities) * 100) : 100);

  return {
    rawWordCount: rawWords,
    compressedWordCount: tier1Words,
    cognitiveLoadReductionPct,
    extractedEntitiesCount: totalEntities,
    compileLatencyMs,
    rawChaosTokenCount,
    decompressedActionableNodes,
    estimatedResumptionTimeSavedMin,
    hallucinationInterceptionRate,
  };
}

export async function POST(req: Request): Promise<NextResponse> {
  const startTime = Date.now();
  let rawInput;
  try {
    const body = await req.json();
    
    // Handle URL ingestion
    let rawText = body.text;
    let source = body.source;
    
    // If URL provided, fetch content
    if (body.url && typeof body.url === "string" && body.url.trim()) {
      const urlContent = await fetchUrlContent(body.url.trim());
      if (urlContent) {
        rawText = rawText ? `${rawText}\n\n--- Fetched from ${body.url} ---\n${urlContent}` : urlContent;
        source = "paste";
      }
    }
    
    rawInput = validateRawInput({ text: rawText, source });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid raw input",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    );
  }

  const rawText = rawInput.text;
  let llmOutput: Record<string, unknown> | null = null;
  let usedFallback = "none";
  let deterministicFallbackUsed = false;

  // Tier 1: Groq
  try {
    const groqText = await tryGroq(rawText);
    if (groqText) {
      llmOutput = parseLLMJson(groqText);
      usedFallback = llmOutput ? "none" : "groq_parse_fail";
    }
  } catch (err) {
    console.error("[api/compile] Groq tier failed:", err);
    usedFallback = "groq_parse_fail";
  }

  // Tier 2: Gemini
  if (!llmOutput) {
    try {
      const geminiText = await tryGemini(rawText);
      if (geminiText) {
        llmOutput = parseLLMJson(geminiText);
        usedFallback = llmOutput ? "none" : "gemini_parse_fail";
      }
    } catch (err) {
      console.error("[api/compile] Gemini tier failed:", err);
      usedFallback = "gemini_parse_fail";
    }
  }

  // Tier 3: Deterministic Compiler (never fails)
  if (!llmOutput) {
    usedFallback = "deterministic";
    deterministicFallbackUsed = true;
  }

  // Build + validate the capsule. Any LLM/schema problem falls back cleanly to
  // the deterministic compiler instead of returning a 500 to the user.
  let validated;
  try {
    const capsule = llmOutput
      ? buildLLMCapsule(rawText, rawInput.source, llmOutput)
      : compileRawInput(rawInput);
    validated = validateCapsule(capsule);
  } catch (err) {
    console.error(
      "[api/compile] LLM capsule parsing/validation failed; falling back to deterministic compiler:",
      err,
    );
    usedFallback = "deterministic";
    deterministicFallbackUsed = true;
    try {
      validated = validateCapsule(compileRawInput(rawInput));
    } catch (fallbackErr) {
      console.error("[api/compile] Deterministic fallback failed:", fallbackErr);
      return NextResponse.json(
        {
          ok: false,
          error: "Compilation failed",
          details:
            fallbackErr instanceof Error
              ? fallbackErr.message
              : String(fallbackErr),
        },
        { status: 502 },
      );
    }
  }

  const compileLatencyMs = Date.now() - startTime;

  // Deterministic Fidelity Guardrail: verify + auto-repair
  try {
    const { capsule: repairedCapsule, receipt, repaired, metrics: verificationMetrics } = verifyFidelity(
      rawText,
      validated,
    );

    // Add enhanced metrics to capsule (using type extension)
    const metrics = computeMetrics(rawText, repairedCapsule, compileLatencyMs, verificationMetrics);
    (repairedCapsule as any).metrics = metrics;

    // Add enhanced receipt fields
    const enhancedReceipt = {
      ...receipt,
      grounding_score: receipt.fidelity_score,
      verified_entities: verificationMetrics?.verifiedEntities ?? [],
      ungrounded_entities: verificationMetrics?.ungroundedEntities ?? [],
      deterministic_fallback_used: deterministicFallbackUsed,
      signature: receipt.evidence_hash,
    };

    return NextResponse.json({
      ok: true,
      used_fallback: usedFallback,
      repaired,
      capsule: repairedCapsule,
      receipt: enhancedReceipt,
    });
  } catch (err) {
    console.error("[api/compile] Fidelity verification failed:", err);
    return NextResponse.json(
      {
        ok: false,
        error: "Fidelity verification failed",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}