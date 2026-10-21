/**
 * ForgeState — Judge Demo Presets
 *
 * Four rich, 1-click demo scenarios including the Hallucination Trap demo
 * (LLM drops a file path / deadline; verifier intercepts and auto-repairs).
 */

import type { RawInput } from "./flowdesk-contracts";

export const PRESETS: Array<{
  id: string;
  title: string;
  subtitle: string;
  input: RawInput;
  expectedTokens: string[];
}> = [
  {
    id: "1",
    title: "Late-Night Debug Spiral",
    subtitle: "2 AM, stuck, cognitive fatigue",
    input: {
      text: "It's 2 AM and I'm completely overwhelmed. I was debugging the checkout flow in src/pages/checkout.tsx around line 214 when the Stripe webhook started returning 402 errors. I tried clearing the cache, restarting the dev server, and rolling back to v1.2 but none of it worked. Sarah (@sarah.lee) said the API key might be expired. Deadline is Friday, October 24th. I need to ship before the hackathon cutoff.",
      source: "voice" as const,
    },
    expectedTokens: [
      "src/pages/checkout.tsx",
      "214",
      "402",
      "Sarah",
      "sarah.lee",
      "October 24th",
    ],
  },
  {
    id: "2",
    title: "Chaotic Slack Handoff",
    subtitle: "Messy handoff between teammates",
    input: {
      text: "Handoff: login page is broken after the redirect refactor. Check src/components/auth/LoginForm.tsx line 88. The OAuth callback to https://auth.example.com/callback is dropping state. I already tried clearing cookies and reverting the redirect URI — dead end. Ping @devon and @maya if you pick this up. Needs to be done by EOD Wednesday.",
      source: "paste" as const,
    },
    expectedTokens: [
      "src/components/auth/LoginForm.tsx",
      "88",
      "https://auth.example.com/callback",
      "devon",
      "maya",
      "Wednesday",
    ],
  },
  {
    id: "3",
    title: "Stack Trace & Dead Ends",
    subtitle: "Already-tried-and-failed firewall",
    input: {
      text: "Production incident: payment-webhook worker crashing with ECONNREFUSED at src/workers/payment-worker.ts:45. Tried: increasing pool size to 50, restarting worker pods, flushing Redis — all failed. The Postgres connection string in .env.production looks wrong. On-call: @ops-team. SLA breach in 90 minutes.",
      source: "text" as const,
    },
    expectedTokens: [
      "src/workers/payment-worker.ts",
      "45",
      "ECONNREFUSED",
      ".env.production",
      "ops-team",
      "90 minutes",
    ],
  },
  {
    id: "4",
    title: "HALLUCINATION TRAP — Verifier Stress Test",
    subtitle: "LLM drops a deadline & file path; verifier auto-repairs",
    input: {
      text: "Critical: the export pipeline in src/lib/export-pipeline.ts line 302 times out after 30 seconds when files exceed 50MB. The S3 upload to https://s3.amazonaws.com/bucket/export fails silently. I already tried bumping the timeout and compressing first — dead end. Must be fixed by Monday, November 3rd or the client cuts the contract. Assign to @devops-lead.",
      source: "text" as const,
    },
    expectedTokens: [
      "src/lib/export-pipeline.ts",
      "302",
      "50MB",
      "https://s3.amazonaws.com/bucket/export",
      "November 3rd",
      "devops-lead",
    ],
  },
];
