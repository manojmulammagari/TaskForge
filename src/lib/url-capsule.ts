/**
 * ForgeState — URL Capsule Compression
 *
 * Base64/URI-safe state compression (`#capsule=...`) + localStorage persistence.
 * Enables shareable, bookmarkable resumption capsules.
 */

const STORAGE_KEY = "forgestate_capsules";

export interface StoredCapsule {
  id: string;
  created_at: string;
  summary: string;
  anchor: string;
  compressed: string;
}

function bytesToBinary(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}

function binaryToBytes(binary: string): Uint8Array {
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function encodeBase64(bytes: Uint8Array): string {
  return btoa(bytesToBinary(bytes));
}

function decodeBase64(value: string): Uint8Array {
  return binaryToBytes(atob(value));
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

  // TextEncoder/TextDecoder are the modern UTF-8-safe replacement for the
  // deprecated escape()/unescape() dance, and handle emoji/CJK correctly.
  const bytes = new TextEncoder().encode(json);
  const b64 = encodeBase64(bytes);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function decompressCapsule(token: string): unknown {
  try {
    if (typeof token !== "string" || token.length === 0) return null;

    const normalized = token
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .replace(/\s/g, "");

    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)) return null;

    const padded =
      normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const bytes = decodeBase64(padded);
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
  } catch {
    // ignore storage errors
  }
}

export function listStoredCapsules(): StoredCapsule[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}
