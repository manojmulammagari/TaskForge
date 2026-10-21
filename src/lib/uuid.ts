/**
 * ForgeState — UUID utilities
 *
 * Web Crypto is not guaranteed to exist in every runtime (older browsers,
 * hardened test environments, some edge workers). Every identifier that the
 * contracts require to be a UUID therefore goes through this module so the
 * application can never crash while trying to mint one.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** True when `value` is a standard RFC 4122 UUID (v1–v5). */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

function fillRandomBytes(bytes: Uint8Array): void {
  const cryptoApi =
    typeof globalThis !== "undefined"
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;

  if (cryptoApi && typeof cryptoApi.getRandomValues === "function") {
    try {
      cryptoApi.getRandomValues(bytes);
      return;
    } catch {
      // Fall through to the Math.random fallback below.
    }
  }

  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Math.floor(Math.random() * 256);
  }
}

function bytesToUuidV4(bytes: Uint8Array): string {
  // Version 4 + RFC 4122 variant bits.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

/**
 * Generate a compliant UUID v4. Prefers Web Crypto, then
 * `crypto.getRandomValues`, then a Math.random fallback. Never throws.
 */
export function generateUuidV4(): string {
  const cryptoApi =
    typeof globalThis !== "undefined"
      ? (globalThis.crypto as Crypto | undefined)
      : undefined;

  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    try {
      return cryptoApi.randomUUID();
    } catch {
      // Continue with the byte-based fallback.
    }
  }

  const bytes = new Uint8Array(16);
  fillRandomBytes(bytes);
  return bytesToUuidV4(bytes);
}

/** Small deterministic string hash (FNV-1a) used for legacy ID migration. */
function hash32(input: string, seed: number): number {
  let hash = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  hash += hash << 13;
  hash ^= hash >>> 7;
  hash += hash << 3;
  hash ^= hash >>> 17;
  hash += hash << 5;
  return hash >>> 0;
}

function deterministicUuidV4(seed: string): string {
  const hex = [0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f]
    .map((salt) => hash32(seed, salt).toString(16).padStart(8, "0"))
    .join("");

  const chars = hex.split("");
  chars[12] = "4";
  chars[16] = ((parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);

  return [
    chars.slice(0, 8).join(""),
    chars.slice(8, 12).join(""),
    chars.slice(12, 16).join(""),
    chars.slice(16, 20).join(""),
    chars.slice(20, 32).join(""),
  ].join("-");
}

/**
 * Normalize an identifier into a valid UUID.
 *
 * Standard UUIDs are preserved (lower-cased). Legacy/opaque IDs are mapped
 * deterministically to a valid UUID so receipts remain stable across
 * re-validations. Non-string values are returned untouched for Zod to reject.
 */
export function coerceUuid(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (isUuid(trimmed)) return trimmed.toLowerCase();
  return deterministicUuidV4(trimmed);
}

/**
 * Guaranteed-valid UUID: mirrors `coerceUuid` but falls back to a freshly
 * generated v4 UUID when the input is missing, empty, or non-string.
 */
export function ensureUuid(value: unknown): string {
  const coerced = coerceUuid(value);
  return isUuid(coerced) ? coerced : generateUuidV4();
}
