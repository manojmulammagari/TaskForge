import type { Metadata } from "next";
import "./globals.css";
import { ToastContainer } from "@/components/ToastContainer";

export const metadata: Metadata = {
  title: "ForgeState — Zero-Tax Context Compiler",
  description:
    "A cognitive decompression engine that turns chaotic brain dumps into verified resumption capsules. Built for the Taskforge Hackathon.",
  openGraph: {
    title: "ForgeState — Git Stash for the Human Brain",
    description: "Accessible task resumption & handoff tool for the Taskforge Devpost Hackathon.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className="antialiased selection:bg-amber-500 selection:text-[#0B0D11]">
        {/* Skip-to-content link — first focusable element */}
        <a href="#main-content" id="skip-to-content">
          Skip to main content
        </a>

        {/* ARIA live announcer for dynamic status updates (polite) */}
        <div
          id="status-announcer"
          aria-live="polite"
          aria-atomic="true"
          className="pointer-events-none"
        ></div>

        <header className="sticky top-0 z-40 border-b border-b-swiss-border bg-swiss-bg/95 backdrop-blur">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-instrument bg-amber-500 border border-black/20 flex items-center justify-center text-black text-xs font-mono font-bold tracking-tighter">
                FS
              </div>
              <span className="font-bold text-lg tracking-tight text-swiss-text">
                ForgeState
              </span>
              <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20">
                v1.0.0
              </span>
            </div>
            <div className="flex items-center gap-2" aria-label="Theme & mode">
              <button
                id="theme-toggle"
                aria-pressed="false"
                suppressHydrationWarning
                className="cognitive-control"
                title="Toggle Calm Light / Focus Dark mode"
              >
                <span className="sr-only">Toggle theme</span>
                <svg
                  className="w-5 h-5 text-swiss-text"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </header>

        <main id="main-content" tabIndex={-1}>
          {children}
        </main>

        <ToastContainer />

        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function(){
                const html = document.documentElement;
                const btn = document.getElementById('theme-toggle');
                const key = 'forgestate:theme';
                let saved = null;
                try {
                  saved = localStorage.getItem(key);
                } catch (err) {
                  // Storage can be blocked (private browsing, sandboxed frames).
                }
                if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  html.classList.add('dark');
                  if (btn) btn.setAttribute('aria-pressed', 'true');
                }
                btn?.addEventListener('click', function(){
                  const isDark = html.classList.toggle('dark');
                  const theme = isDark ? 'dark' : 'light';
                  btn.setAttribute('aria-pressed', String(isDark));
                  try {
                    localStorage.setItem(key, theme);
                  } catch (err) {
                    // Keep the toggle functional even when storage is unavailable.
                  }
                  window.dispatchEvent(new CustomEvent('forgestate:theme', {
                    detail: { theme: theme }
                  }));
                  const ann = document.getElementById('status-announcer');
                  if (ann) ann.textContent = 'Theme switched to ' + (isDark ? 'Focus Dark' : 'Calm Light') + ' mode.';
                });
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
