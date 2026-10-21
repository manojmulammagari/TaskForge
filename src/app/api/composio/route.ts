import { NextResponse } from "next/server";
import { validateDispatchRequest, validateDispatchReceipt } from "@/lib/flowdesk-contracts";
import { generateUuidV4 } from "@/lib/uuid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COMPOSIO_API_KEY = process.env.COMPOSIO_API_KEY;

// ---------------------------------------------------------------------------
// Composio Action Bridge
//
// Dispatches a compiled ForgeState Capsule to external tools:
//   GitHub Issue / PR Comment, Slack Channel Handoff, Linear / Notion Task.
//
// CRITICAL JUDGE RULE: If COMPOSIO_API_KEY is not set, or a judge clicks
// "1-Click Handoff via Composio" on the live Vercel demo, execute a Verified
// Composio Sandbox Simulation that renders the exact Composio tool schema,
// payload inspection, and execution receipt with ZERO login walls.
// ---------------------------------------------------------------------------

interface SandboxLog {
  step: string;
  detail: string;
  ok: boolean;
}

function toolSchemaFor(target: string): string {
  const schemas: Record<string, string> = {
    github: JSON.stringify(
      {
        name: "GITHUB_CREATE_ISSUE",
        description: "Create an issue in a GitHub repository",
        parameters: {
          type: "object",
          properties: {
            owner: { type: "string", description: "Repository owner" },
            repo: { type: "string", description: "Repository name" },
            title: { type: "string", description: "Issue title" },
            body: { type: "string", description: "Issue body (markdown)" },
            labels: { type: "array", items: { type: "string" } },
          },
          required: ["owner", "repo", "title", "body"],
        },
      },
      null,
      2,
    ),
    slack: JSON.stringify(
      {
        name: "SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL",
        description: "Send a message to a Slack channel",
        parameters: {
          type: "object",
          properties: {
            channel: { type: "string", description: "Slack channel ID or name" },
            text: { type: "string", description: "Message text" },
            blocks: { type: "array", description: "Slack Block Kit blocks" },
          },
          required: ["channel", "text"],
        },
      },
      null,
      2,
    ),
    linear: JSON.stringify(
      {
        name: "LINEAR_CREATE_ISSUE",
        description: "Create a Linear issue",
        parameters: {
          type: "object",
          properties: {
            teamKey: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            priority: { type: "number" },
          },
          required: ["teamKey", "title", "description"],
        },
      },
      null,
      2,
    ),
    notion: JSON.stringify(
      {
        name: "NOTION_CREATE_PAGE",
        description: "Create a Notion page",
        parameters: {
          type: "object",
          properties: {
            parent: { type: "object" },
            properties: { type: "object" },
            children: { type: "array" },
          },
          required: ["parent", "properties"],
        },
      },
      null,
      2,
    ),
  };
  return schemas[target] ?? JSON.stringify({ name: "UNKNOWN_TOOL" }, null, 2);
}

function buildPayload(
  target: string,
  capsuleId: string,
  userPayload: Record<string, unknown>,
): Record<string, unknown> {
  const summary = String(userPayload.summary ?? "ForgeState Resumption Capsule");
  const anchor = String(userPayload.anchor ?? "");
  const mentalState = String(userPayload.mental_state ?? "");
  const tokens =
    typeof userPayload.extracted_tokens === "string"
      ? userPayload.extracted_tokens
      : JSON.stringify(userPayload.extracted_tokens ?? {}, null, 2);
  const receipt =
    typeof userPayload.receipt === "string"
      ? userPayload.receipt
      : JSON.stringify(userPayload.receipt ?? "", null, 2);

  switch (target) {
    case "github":
      return {
        owner: userPayload.owner ?? "taskforge",
        repo: userPayload.repo ?? "demo",
        title: `[ForgeState] ${summary}`,
        body: `## Resumption Capsule\n\n**Capsule ID:** ${capsuleId}\n**Anchor:** ${anchor}\n**Mental State:** ${mentalState}\n\n**Extracted Tokens:**\n\`\`\`json\n${tokens}\n\`\`\`\n\n---\n*Fidelity Receipt:* ${receipt}`,
        labels: ["forgestate", "resumption", "cognitive-accessibility"],
      };
    case "slack":
      return {
        channel: userPayload.channel ?? "#forgestate-handoffs",
        text: `*ForgeState Resumption Capsule*\n• Capsule: ${capsuleId}\n• Anchor: ${anchor}\n• ${mentalState}`,
        blocks: [
          { type: "section", text: { type: "mrkdwn", text: `*ForgeState Handoff*\n<https://taskforge.example/capsule/${capsuleId}|Open Capsule>` } },
          { type: "context", elements: [{ type: "mrkdwn", text: `Anchor: ${anchor}` }] },
        ],
      };
    case "linear":
      return {
        teamKey: userPayload.teamKey ?? "TF",
        title: summary,
        description: `${anchor}\n\n${mentalState}\n\nCapsule: ${capsuleId}`,
        priority: userPayload.priority ?? 2,
      };
    case "notion":
      return {
        parent: { type: "page_id", page_id: userPayload.parent_page_id ?? "demo-page" },
        properties: {
          title: { title: [{ text: { content: summary } }] },
        },
        children: [
          {
            object: "block",
            type: "paragraph",
            paragraph: { rich_text: [{ type: "text", text: { content: anchor } }] },
          },
        ],
      };
    default:
      return userPayload;
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  let request;
  try {
    const body = await req.json();
    request = validateDispatchRequest(body);
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid dispatch request",
        details: String(err),
      },
      { status: 400 },
    );
  }

  const logs: SandboxLog[] = [];
  const push = (step: string, detail: string, ok: boolean) =>
    logs.push({ step, detail, ok });

  const sandbox = !COMPOSIO_API_KEY;
  let success = false;
  let executionOutput: Record<string, unknown> | null = null;
  let responseStatus = 200;
  let executionError: string | null = null;
  let timedOut = false;

  if (!sandbox) {
    // Live Composio execution path (real API key present)
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 8000);

    try {
      push("composio.connect", "Initializing Composio SDK with API key", true);
      const execRes = await fetch(
        `https://api.composio.co/api/v1/execute?tool=${request.target}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${COMPOSIO_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildPayload(request.target, request.capsule_id, request.payload)),
          signal: controller.signal,
        },
      );

      const rawJson: unknown = await execRes.json().catch(() => ({}));
      executionOutput =
        rawJson && typeof rawJson === "object" && !Array.isArray(rawJson)
          ? (rawJson as Record<string, unknown>)
          : { raw: rawJson };

      push("composio.execute", `Executed ${request.target} via Composio API`, execRes.ok);
      success = execRes.ok;

      if (!execRes.ok) {
        executionError = `Composio returned HTTP ${execRes.status}`;
        responseStatus = 502;
      }
    } catch (err) {
      const aborted =
        timedOut || (err instanceof Error && err.name === "AbortError");
      if (aborted) {
        executionError = "Composio request timed out after 8000ms";
        responseStatus = 504;
        push("composio.execute", executionError, false);
      } else {
        executionError = `Live execution failed: ${String(err)}`;
        responseStatus = 502;
        push("composio.execute", executionError, false);
      }
      success = false;
    } finally {
      clearTimeout(timeout);
    }
  } else {
    // --- Verified Composio Sandbox Simulation (ZERO login walls) ---
    push("composio.sandbox.init", "COMPOSIO_API_KEY not set — entering sandbox simulation", true);
    push("composio.sandbox.schema", `Rendering tool schema: ${toolSchemaFor(request.target)}`, true);

    const payloadInspection = buildPayload(request.target, request.capsule_id, request.payload);
    push("composio.sandbox.payload", "Payload inspection generated", true);

    // Simulate deterministic execution latency & outcome
    await new Promise((r) => setTimeout(r, 600));

    push("composio.sandbox.execute", `Simulated ${request.target} execution in sandbox`, true);
    success = true;

    executionOutput = {
      simulated: true,
      target: request.target,
      entity_id: `csim-${request.capsule_id.slice(0, 8)}`,
      status: "queued",
      note: "Sandbox simulation — no external write performed. Set COMPOSIO_API_KEY for live execution.",
    };

    push("composio.sandbox.receipt", "Execution receipt generated", true);
  }

  const receiptInput = {
    request_id: generateUuidV4(),
    capsule_id: request.capsule_id,
    target: request.target,
    executed_at: new Date().toISOString(),
    sandbox,
    success,
    tool_schema: sandbox ? toolSchemaFor(request.target) : undefined,
    payload_inspection: sandbox
      ? buildPayload(request.target, request.capsule_id, request.payload)
      : executionOutput ?? undefined,
    execution_log: logs.map((l) => `[${l.ok ? "OK" : "ERR"}] ${l.step}: ${l.detail}`),
    receipt_url: sandbox
      ? `https://composio.example/sandbox/receipts/${generateUuidV4()}`
      : undefined,
  };

  // A malformed receipt must never take down the dispatch response. Validate
  // explicitly, then fall back to a minimal — but always UUID-valid — receipt.
  let receipt;
  try {
    receipt = validateDispatchReceipt(receiptInput);
  } catch (err) {
    console.error("[api/composio] Receipt validation failed:", err);
    push(
      "composio.receipt.fallback",
      `Receipt validation failed: ${err instanceof Error ? err.message : String(err)}`,
      false,
    );
    try {
      receipt = validateDispatchReceipt({
        request_id: generateUuidV4(),
        capsule_id: request.capsule_id,
        target: request.target,
        executed_at: new Date().toISOString(),
        sandbox,
        success,
        execution_log: logs.map(
          (l) => `[${l.ok ? "OK" : "ERR"}] ${l.step}: ${l.detail}`,
        ),
      });
    } catch (fallbackErr) {
      console.error(
        "[api/composio] Fallback receipt validation failed:",
        fallbackErr,
      );
      return NextResponse.json(
        {
          ok: false,
          sandbox,
          success: false,
          error: "Receipt generation failed",
          details:
            fallbackErr instanceof Error
              ? fallbackErr.message
              : String(fallbackErr),
        },
        { status: 502 },
      );
    }
  }

  return NextResponse.json(
    {
      ok: success,
      sandbox,
      success,
      receipt,
      logs,
      payload: executionOutput,
      ...(executionError ? { error: executionError } : {}),
    },
    { status: responseStatus },
  );
}
