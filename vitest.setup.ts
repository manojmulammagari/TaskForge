import "@testing-library/jest-dom";

// Mock matchMedia for jsdom
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock Web Speech API (speechSynthesis) for tests
const speechSynthesisMock = {
  speak: () => {},
  cancel: () => {},
  getVoices: () => [],
  paused: false,
  pending: false,
};
Object.defineProperty(window, "speechSynthesis", { writable: true, value: speechSynthesisMock });
