import { randomBytes } from "node:crypto";

/**
 * Generate a UUIDv7 (RFC 9562) — timestamp-sortable, globally unique.
 * Layout: 48-bit unix_ts_ms | 4-bit version(7) | 12-bit rand_a | 2-bit variant(10) | 62-bit rand_b
 */
export function uuidv7(): string {
  const now = Date.now();
  const rand = randomBytes(10);

  // 48-bit timestamp
  const tsHigh = Math.floor(now / 0x10000) & 0xffff_ffff;
  const tsLow = now & 0xffff;

  // Byte 0-3: upper 32 bits of timestamp
  rand[0] = (tsHigh >>> 24) & 0xff;
  rand[1] = (tsHigh >>> 16) & 0xff;
  rand[2] = (tsHigh >>> 8) & 0xff;
  rand[3] = tsHigh & 0xff;

  // Byte 4-5: lower 16 bits of timestamp
  rand[4] = (tsLow >>> 8) & 0xff;
  rand[5] = tsLow & 0xff;

  // Byte 6: version 7 (0111xxxx)
  rand[6] = (rand[6] & 0x0f) | 0x70;

  // Byte 8: variant 10 (10xxxxxx)
  rand[8] = (rand[8] & 0x3f) | 0x80;

  const hex = Array.from(rand).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
