// ============================================================================
// Terminal display width helpers for ASCII/Unicode rendering.
// ============================================================================

/** Sentinel stored in the canvas cell following a fullwidth character. */
export const WIDE_CHAR_CONTINUATION = '\u0000'

export function charVisualWidth(ch: string): number {
  const code = ch.codePointAt(0) ?? 0
  // Combining marks occupy no extra terminal cell.
  if (code >= 0x03_00 && code <= 0x03_6f) {return 0}
  // East Asian wide/fullwidth ranges plus common emoji presentation ranges.
  if (
    (code >= 0x11_00 && code <= 0x11_5f) ||
    (code >= 0x23_29 && code <= 0x23_2a) ||
    (code >= 0x2e_80 && code <= 0xa4_cf) ||
    (code >= 0xac_00 && code <= 0xd7_a3) ||
    (code >= 0xf9_00 && code <= 0xfa_ff) ||
    (code >= 0xfe_10 && code <= 0xfe_19) ||
    (code >= 0xfe_30 && code <= 0xfe_6f) ||
    (code >= 0xff_00 && code <= 0xff_60) ||
    (code >= 0xff_e0 && code <= 0xff_e6) ||
    (code >= 0x1_f3_00 && code <= 0x1_fa_ff) ||
    code >= 0x2_00_00
  ) {return 2}
  return 1
}

export function visualWidth(text: string): number {
  let width = 0
  for (const ch of text) {width += charVisualWidth(ch)}
  return width
}
