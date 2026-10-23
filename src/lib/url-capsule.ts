/**
 * ForgeState — URL Capsule Compression
 *
 * LZ-string compressed state (`#capsule=...`) + localStorage persistence.
 * Enables shareable, bookmarkable resumption capsules with < 2KB URLs.
 * Backwards compatible with legacy Base64 JSON capsules.
 */

import LZString from "lz-string";

const STORAGE_KEY = "forgestate_capsules";

export interface StoredCapsule {
  id: string;
  created_at: string;
  summary: string;
  anchor: string;
  compressed: string;
}

const MAX_FIELD_LENGTH = 20000;

function truncateField(obj: Record<string, unknown>, field: string): void {
  if (obj && typeof obj === "object" && field in obj) {
    const value = obj[field];
    if (typeof value === "string" && value.length > MAX_FIELD_LENGTH) {
      obj[field] = value.slice(0, MAX_FIELD_LENGTH) + "\n... [truncated for URL safety] ...";
    }
  }
}

function isLZCompressed(token: string): boolean {
  // LZString compressed tokens typically contain special chars like ~, and are shorter than raw base64
  // Legacy base64 tokens are pure alphanumeric + - _ = only
  // Heuristic: if token contains chars outside base64url alphabet, it's likely LZ-compressed
  return /[^A-Za-z0-9\-_]/.test(token);
}

export function compressCapsule(capsule: unknown): string {
  // Create a safe shallow clone to avoid mutating the original
  const safeCapsule: Record<string, unknown> = capsule && typeof capsule === "object" 
    ? { ...(capsule as Record<string, unknown>) }
    : {};

  // Truncate large fields that could cause URL size limits / HTTP 414 errors
  truncateField(safeCapsule, "raw_vs_compiled_diff");
  truncateField(safeCapsule, "source_input");

  const json = JSON.stringify(safeCapsule);
  if (json === undefined) {
    throw new Error("Cannot compress an undefined capsule");
  }

  // Compress using LZ-string to base64, then convert to base64url
  // This is more reliable across environments than compressToEncodedURIComponent
  const compressedBase64 = LZString.compressToBase64(json);
  
  if (!compressedBase64) {
    throw new Error("LZ compression returned empty result");
  }

  // Convert standard base64 to base64url (replace +/= with -_ and strip padding)
  const compressed = compressedBase64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return compressed;
}

export function decompressCapsule(token: string): unknown {
  try {
    if (typeof token !== "string" || token.length === 0) return null;

    // Try LZ decompression first (new format - base64url encoded LZ compressed data)
    // The new format uses base64url alphabet (A-Za-z0-9-_)
    if (/^[A-Za-z0-9\-_]+$/.test(token)) {
      // Convert base64url back to standard base64
      const base64 = token
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      
      // Add padding if needed
      const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
      
      try {
        const decompressed = LZString.decompressFromBase64(padded);
        if (decompressed) {
          const parsed: unknown = JSON.parse(decompressed);
          return parsed ?? null;
        }
      } catch {
        // If LZ decompression fails, fall through to legacy
      }
    }

    // Legacy Base64 JSON fallback (for existing judge links)
    const normalized = token
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .replace(/\s/g, "");

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return null;

    const padded =
      normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    
    // Decode base64
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed: unknown = JSON.parse(json);
    return parsed ?? null;
  } catch {
    // Corrupt/truncated/non-UTF-8 payloads are expected from truncated URLs.
    return null;
  }
}

export function capsuleUrlHash(token: string): string {
  return `#capsule=${encodeURIComponent(token)}`;
}

export function parseCapsuleHash(hash: string): string | null {
  try {
    if (typeof hash !== "string" || !hash) return null;
    const match = hash.match(/#capsule=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// localStorage persistence (judge demo persistence)
// ---------------------------------------------------------------------------

export function storeCapsulePreview(capsule: {
  id: string;
  created_at: string;
  summary: string;
  anchor: string;
  compressed: string;
}): void {
  if (typeof window === "undefined") return;
  try {
    const existing = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "[]",
    ) as StoredCapsule[];
    const updated = [capsule, ...existing].slice(0, 20);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    // Ignore storage errors (Safari Private Browsing, quota exceeded, SecurityError, etc.)
    if (err instanceof Error) {
      const isStorageError = 
        err.name === "QuotaExceededError" ||
        err.name === "SecurityError" ||
        err.message.includes("quota") ||
        err.message.includes("private");
      if (!isStorageError) {
        console.warn("[ForgeState] Unexpected localStorage error:", err);
      }
    }
  }
}

export function listStoredCapsules(): StoredCapsule[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch (err) {
    // Ignore storage errors (Safari Private Browsing, quota exceeded, SecurityError, etc.)
    if (err instanceof Error) {
      const isStorageError = 
        err.name === "QuotaExceededError" ||
        err.name === "SecurityError" ||
        err.message.includes("quota") ||
        err.message.includes("private");
      if (!isStorageError) {
        console.warn("[ForgeState] Unexpected localStorage error:", err);
      }
    }
    return [];
  }
}