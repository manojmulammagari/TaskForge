import { describe, it, expect } from "vitest";
import {
  capsuleUrlHash,
  compressCapsule,
  decompressCapsule,
  parseCapsuleHash,
} from "@/lib/url-capsule";

describe("URL capsule compression", () => {
  it("round-trips Unicode content without deprecated escape/unescape", () => {
    const capsule = {
      summary: "Fix the café checkout — 東京 session 🚀",
      nested: { emoji: "✅", text: "naïve" },
    };

    const compressed = compressCapsule(capsule);
    expect(compressed).not.toMatch(/[+/=]/);

    const restored = decompressCapsule(compressed);
    expect(restored).toEqual(capsule);
  });

  it("round-trips through the #capsule= hash format", () => {
    const compressed = compressCapsule({ hello: "world" });
    const hash = capsuleUrlHash(compressed);
    const token = parseCapsuleHash(hash);

    expect(token).toBe(compressed);
    expect(decompressCapsule(token as string)).toEqual({ hello: "world" });
  });

  it("returns null for malformed, truncated, and non-JSON payloads", () => {
    expect(decompressCapsule("not-base64!!!")).toBeNull();
    expect(decompressCapsule("W10")).toEqual([]); // "[]" is valid JSON
    expect(decompressCapsule("")).toBeNull();
    expect(decompressCapsule("aGVsbG8")).toBeNull(); // "hello" is not JSON
    expect(decompressCapsule("//4")).toBeNull(); // invalid UTF-8 bytes
  });

  it("returns null instead of throwing for a broken hash encoding", () => {
    expect(parseCapsuleHash("#capsule=%E0%A4%A")).toBeNull();
    expect(parseCapsuleHash("")).toBeNull();
  });
});
