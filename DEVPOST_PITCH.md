# ForgeState — Devpost Hackathon Submission Pitch

**Event:** Taskforge Devpost Hackathon  
**Deadline:** October 24, 2026  
**Submission:** ForgeState — "Git Stash for the Human Brain"  
**Theme:** Accessible tools that help people focus, organize, and get more done.

---

## One-Liner

A zero-tax context compiler that turns a 15-second chaotic brain dump into a verified, resumable task capsule — cutting the 23–45 minute "where did I leave off?" resumption tax down to under 2 minutes.

---

## The Problem

Interruptions kill flow. When a developer with ADHD, cognitive fatigue, or a screen reader is interrupted mid-task (or receives a chaotic Slack handoff), reconstructing context takes **23–45 minutes**. Teammates and Tomorrow-You repeat dead-end debugging because there's no record of what was already tried. The tool leaves the most vulnerable users behind.

## The Solution — ForgeState

ForgeState is a **Cognitive Decompression Engine** built around four pillars:

### 1. Zero-Decision Re-Entry Anchor
A single physical action under 2 minutes. No blank-page paralysis.

### 2. Dead-Ends Firewall
An explicit, auditable log of what was *already tried and failed*. Nobody repeats a dead end.

### 3. Deterministic Fidelity Guardrail (Technical Execution)
A pure TypeScript parser extracts every hard token — file paths, line numbers, URLs, dates/deadlines, people mentions, metrics — from the raw input and mathematically verifies **100% survival** in the AI-compiled output. If the LLM drops a deadline or hallucinates a path, the verifier **intercepts it, auto-restores the exact token, and prints a FlowDesk Fidelity Receipt**. This directly addresses the double-weighted Technical Execution rubric with verifiable, auditable evidence.

### 4. 3-Level Cognitive Decompression Slider
- **L1 Calm:** 1 sentence + 1 giant action card + 1-click 15-second spatial audio briefing (Web Audio API 300Hz→660Hz earcons + Web Speech API).
- **L2 Structured Handoff Board:** 3-column bento (Mental State, Dead-Ends, Micro-Steps checklist).
- **L3 Full Technical Audit:** Raw-vs-Compiled diff, Fidelity Receipt, `#capsule=` URL compression, and 1-click Composio dispatch to GitHub/Slack/Linear/Notion.

---

## Why This Wins First Place

| Rubric | How ForgeState delivers |
|---|---|
| **Theme Alignment** | Directly targets overwhelming task lists, inaccessible workflows, and confusing handoffs. |
| **Accessibility** | WCAG AAA target: high-contrast mode, bionic reading, dyslexia tokens, skip links, ARIA live announcer, cognitive-load-matched UI levels, spatial audio briefing. |
| **Technical Execution** | Deterministic fidelity guardrail with mathematically proven token survival + auto-repair + auditable receipts. 9 unit tests proving extraction, interception, and repair. |
| **Demo-Readiness** | Zero login wall. Deterministic compiler fallback means the app never fails. Composio sandbox simulation renders exact tool schemas + receipts with no API keys. Four one-click judge presets including a "Hallucination Trap" stress test. |

---

## Demo Script (2 minutes)

1. Click preset **[4] Hallucination Trap**.
2. Click **Forge Capsule**.
3. Notice the **Fidelity Score** and the **Auto-Repair** block — the verifier caught dropped tokens.
4. Switch the **Cognitive Slider** to L1 Calm. Click **15-Second Spatial Audio Briefing**.
5. Switch to **L3 Full Technical Audit**. See the Raw vs. Compiled diff and Fidelity Receipt.
6. Click **Copy Share URL** — the capsule is bookmarkable via `#capsule=...`.
7. Click **Composio → GitHub Issue** — a verified sandbox receipt issues with zero auth (or live dispatch if `COMPOSIO_API_KEY` is set).

---

## Tech Stack

Next.js 14 (App Router) · TypeScript · Tailwind CSS · Lucide React · Zod · Vitest + jsdom

Design tokens: Calm Light `#FAF8F5`, Focus Dark `#0B0D11`, amber `#F59E0B`, emerald `#10B981`. Zero AI-purple gradients.

---

## Deployment

Deploy to Vercel. No build-time secrets required:
- `GROQ_API_KEY` / `GEMINI_API_KEY`: optional (LLM tiers)
- `COMPOSIO_API_KEY`: optional (live dispatch); without it, `/api/composio` runs a Verified Sandbox Simulation with zero login walls.

The deterministic compiler guarantees the demo works end-to-end for judges with no credentials.

---

## Links

- **Repo:** this repository  
- **Live Demo:** (Vercel URL on deploy)  
- **README:** ./README.md
