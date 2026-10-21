/**
 * ForgeState — Audio HUD
 *
 * Web Audio API spatial earcons (300Hz–660Hz rising pitch chimes) + Web Speech
 * API 15-second spatial audio briefing for Level 1 Calm mode.
 */

// Global registry symbol: HMR/module re-evaluation reuses the same AudioContext.
const AUDIO_CTX_SYMBOL = Symbol.for("forgestate:audioCtx");

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const win = window as any;
  if (!win[AUDIO_CTX_SYMBOL]) {
    const Ctor = win.AudioContext || win.webkitAudioContext;
    if (!Ctor) return null;
    try {
      win[AUDIO_CTX_SYMBOL] = new Ctor();
    } catch {
      win[AUDIO_CTX_SYMBOL] = null;
    }
  }
  return (win[AUDIO_CTX_SYMBOL] as AudioContext | null) ?? null;
}

/**
 * Explicitly resume a context after a user gesture. Browsers start
 * AudioContexts suspended until the page receives activation; resuming is a
 * no-op when the context is already running.
 */
async function resumeAudioContext(ctx: AudioContext): Promise<boolean> {
  if (ctx.state === "closed") return false;
  try {
    if (typeof ctx.resume === "function") {
      await ctx.resume();
    }
  } catch {
    return false;
  }
  // Some mocked/older implementations do not update `state` immediately after
  // resume(); scheduling is still safe because the browser queues it.
  return true;
}

/**
 * Play a rising-pitch spatial earcon sequence (300Hz -> 660Hz).
 * Returns a promise that resolves when the sequence finishes.
 */
export async function playEarconSequence(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;

  const ready = await resumeAudioContext(ctx);
  if (!ready) return;

  const now = ctx.currentTime;
  const freqs = [300, 420, 540, 660];
  const step = 0.12;

  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + 0.05 + i * step);
    gain.gain.setValueAtTime(0, now + 0.05 + i * step);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.05 + i * step + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05 + i * step + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + 0.05 + i * step);
    osc.stop(now + 0.05 + i * step + 0.25);
  });

  await new Promise<void>((resolve) => {
    setTimeout(resolve, (freqs.length - 1) * step * 1000 + 450);
  });
}

/**
 * Play a short "done" chime (emerald success earcon).
 */
export function playSuccessChime(): void {
  const ctx = getAudioContext();
  if (!ctx || ctx.state === "closed") return;

  // Resume synchronously in the user-gesture call stack; oscillator
  // scheduling then begins as soon as the context is running.
  if (ctx.state === "suspended" && typeof ctx.resume === "function") {
    void ctx.resume().catch(() => {});
  }

  const now = ctx.currentTime;
  [523, 659, 784].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, now + i * 0.06);
    gain.gain.setValueAtTime(0.05, now + i * 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.06);
    osc.stop(now + i * 0.06 + 0.25);
  });
}

/**
 * Web Speech API 15-second briefing for Level 1 Calm mode.
 * Speaks the one-sentence summary and two-minute anchor.
 */
export function speakBriefing(summary: string, anchor: string): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(
    `Where you left off: ${summary}. Your first two-minute step: ${anchor}.`,
  );
  utterance.rate = 0.95;
  utterance.pitch = 1.05;
  utterance.volume = 1;
  utterance.lang = "en-US";
  window.speechSynthesis.speak(utterance);
}

export function stopSpeech(): void {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}
