# ForgeState

[![CI Verification](https://github.com/manojmulammagari/TaskForge/actions/workflows/ci.yml/badge.svg)](https://github.com/manojmulammagari/TaskForge/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-1.6-brightgreen?logo=vitest)](https://vitest.dev/)

**"Git Stash for the Human Brain"** — a Zero-Tax Context Compiler & Cognitive Decompression Engine.

Built for the **Taskforge Devpost Hackathon** (Deadline: Oct 24, 2026). ForgeState converts a 15-second chaotic brain dump (voice or messy text + errors + links) into a **Verified Resumption Capsule** so developers, students, and anyone with ADHD, cognitive fatigue, or screen-reader needs can resume interrupted work in under 2 minutes instead of 23–45.

> Zero login wall. 100 Lighthouse A11y. Works offline via a deterministic compiler fallback — the app never fails during judging.

---

## The Problem: The 23-Minute Resumption & Handoff Tax

When a developer is interrupted at 2 AM, or receives a chaotic project handoff (messy Slack messages, stack traces, 9 open links, half-finished code), it takes **23–45 minutes** to figure out:
- Where did work stop?
- What was already tried and failed?
- What is my exact first 2-minute physical step?

That cognitive tax is the accessibility barrier ForgeState removes.

---

## The Solution

| Feature | What it does |
|---|---|
| **Zero-Decision Re-Entry Anchor** | A single `< 2 minute` physical action cures task-initiation paralysis. |
| **Dead-Ends Firewall** | Explicit log of what was *already tried and failed* so nobody repeats dead-end debugging. |
| **Deterministic Fidelity Guardrail** | Pure TypeScript parser extracts every hard token (`file_paths`, `line_numbers`, `urls`, `dates_deadlines`, `people_mentions`, `metrics`) and mathematically verifies 100% survival. Dropped/hallucinated tokens are intercepted, auto-restored, and recorded on an auditable **FlowDesk Fidelity Receipt**. |
| **3-Level Cognitive Decompression Slider** | Calm / Structured Handoff / Full Technical Audit — matches the user's cognitive load. |
| **Composio 1-Click Cross-App Handoff** | Dispatch the capsule to GitHub Issue, Slack Channel, Linear, or Notion — live via Composio SDK, or a **Verified Composio Sandbox Simulation** with zero login walls when no API key is present. |
| **URL Hash Compression** | Shareable, bookmarkable capsules via `#capsule=...` + `localStorage` persistence. |

---

## 3-Level Cognitive Decompression (Signature Accessibility Innovation)

- **Level 1 — Calm** (overwhelmed / low working memory): Hides 85% of UI. Shows only **1 sentence** ("Where you left off") + **1 giant primary action card** ("Do this 2-min step first") + a **1-click 15-Second Spatial Audio Briefing** (Web Audio API rising-pitch earcons 300Hz→660Hz + Web Speech API readout).
- **Level 2 — Structured Handoff Board**: 3-column bento grid (*Current Mental State*, *Dead-Ends Firewall*, *Ordered Micro-Steps* with interactive checklist).
- **Level 3 — Full Technical Audit & Composio Dispatch**: Side-by-side Raw vs. Compiled Diff, the **Deterministic Fidelity Receipt**, URL Hash Compression, and the **Composio 1-Click Cross-App Handoff**.

---

## Design System: "Tactile Swiss Instrumentation"

- **Calm Light Mode:** warm alabaster `#FAF8F5`
- **Focus Dark Mode:** deep obsidian `#0B0D11`
- **Semantic badges:** amber `#F59E0B` / emerald `#10B981`
- Monospace telemetry readouts, zero generic AI-purple gradients
- WCAG AAA contrast, dyslexia-friendly spacing, **bionic reading** toggle, `prefers-reduced-motion` support
- Skip-to-content link, ARIA live announcer, visible focus rings, semantic HTML5 landmarks

---

## File Tree (per spec)

```
src/
├── app/
│   ├── layout.tsx            # Semantic landmarks, skip-to-content, ARIA live announcer, theme toggle
│   ├── page.tsx              # Single-screen adaptive workspace, 3-tier compile orchestration
│   ├── globals.css           # Tactile Swiss tokens, WCAG AAA, bionic, reduced-motion
│   └── api/
│       ├── compile/route.ts  # 3-tier failover: Groq -> Gemini -> Deterministic Compiler
│       └── composio/route.ts # Composio bridge (live + zero-auth sandbox simulation)
├── lib/
│   ├── flowdesk-contracts.ts # Zod schemas + durable session evidence contracts
│   ├── fidelity-verifier.ts  # Pure TS extractor + hallucination catcher & auto-repair
│   ├── deterministic-compiler.ts # Offline/zero-key fallback compiler
│   ├── audio-hud.ts          # Web Audio API earcons + Web Speech API briefing
│   ├── url-capsule.ts        # #capsule= compression + localStorage persistence
│   ├── presets.ts            # 4 one-click judge demo scenarios (incl. Hallucination Trap)
│   └── toast.ts              # Lightweight toast pub/sub
├── components/
│   ├── JudgeControlBar.tsx   # 1-click presets [1]-[4], telemetry, fallback indicator
│   ├── AccessibilityDock.tsx # 3-level slider, high-contrast, bionic, audio toggles
│   ├── ChaosCapturePane.tsx  # Voice dictation + messy text + forge trigger
│   ├── DecompressionCanvas.tsx # Adaptive L1/L2/L3 renderer
│   ├── FidelityReceiptModal.tsx # Verifiable token evidence + intercepted-hallucination proof
│   ├── ComposioDispatchBar.tsx # 1-click GitHub/Slack/Linear/Notion + share URL
│   └── ToastContainer.tsx    # System notifications
└── __tests__/
    └── fidelity-verifier.test.ts   # 9 Vitest unit tests
```

---

## 4 One-Click Judge Demo Presets

| # | Preset | What it demonstrates |
|---|---|---|
| [1] | Late-Night Debug Spiral | 2 AM overwhelm, Stripe 402, deadline Oct 24 |
| [2] | Chaotic Slack Handoff | OAuth redirect, teammate mentions, EOD deadline |
| [3] | Stack Trace & Dead Ends | ECONNREFUSED, pool size, Redis flush — all failed |
| [4] | **Hallucination Trap** | LLM drops a file path + deadline; the verifier **intercepts & auto-repairs** to 100% fidelity |

Click any preset, then **Forge Capsule**. Open the **Fidelity Receipt** to see intercepted tokens and the auto-repair block.

---

## Tech Stack

Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React, Zod, Vitest + jsdom. No AI-purple dependencies.

---

## Environment Variables

| Variable | Purpose | Required? |
|---|---|---|
| `GROQ_API_KEY` | Tier-1 LLM (llama-3.3-70b) | Optional |
| `GEMINI_API_KEY` | Tier-2 LLM (gemini-2.5-flash) | Optional |
| `COMPOSIO_API_KEY` | Live Composio dispatch (GitHub/Slack/Linear/Notion) | Optional |

**If `COMPOSIO_API_KEY` is unset, the `/api/composio` endpoint runs a Verified Composio Sandbox Simulation** that renders the exact tool schemas (`GITHUB_CREATE_ISSUE`, `SLACK_SENDS_A_MESSAGE_TO_A_SLACK_CHANNEL`), payload inspection, and an execution receipt — **zero login walls**, so judges can demo on the live Vercel URL without any credentials.

---

## Getting Started

```bash
# Install
npm install

# Dev server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Unit tests (fidelity verifier)
npm test
```

---

## Accessibility (WCAG AAA target)

- Skip-to-content link (first focusable element)
- ARIA live `status-announcer` region for dynamic feedback
- Visible focus rings (`3px amber`) on all interactive elements
- High-contrast AAA mode toggle (`#000`/`#fff`)
- Calm Light `#FAF8F5` / Focus Dark `#0B0D11` themes
- Bionic reading toggle
- 15-second spatial audio briefing (Web Audio + Web Speech)
- `prefers-reduced-motion` respected
- Screen-reader audio announcements toggle
- 3-Level Cognitive Decompression Slider matched to user load

---

## License

MIT. Built for the Taskforge Devpost Hackathon.

---

## Demo

Live on Vercel: the compiled Next.js app deploys with zero build-time secrets required — the deterministic compiler and Composio sandbox guarantee the demo works for judges with no API keys configured.
