// Text helpers shared by the writers (3.4, 4.6, 4.7, 5.3). See design.md, "PDF writer".
// Everything here is locale-independent and deterministic.

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

/** True when `value` is a `#rrggbb` hex colour (1.4). */
export function isHexColour(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOUR.test(value);
}

/** Red, green and blue of a `#rrggbb` colour, each 0 to 255. */
export function hexToRgb(colour: string): readonly [number, number, number] {
  return [
    parseInt(colour.slice(1, 3), 16),
    parseInt(colour.slice(3, 5), 16),
    parseInt(colour.slice(5, 7), 16),
  ];
}

/** Escapes text for XML character data and attribute values (5.3). */
export function escapeXml(text: string): string {
  let out = "";
  for (const char of text) {
    switch (char) {
      case "&":
        out += "&amp;";
        break;
      case "<":
        out += "&lt;";
        break;
      case ">":
        out += "&gt;";
        break;
      case '"':
        out += "&quot;";
        break;
      case "'":
        out += "&apos;";
        break;
      default: {
        // Control characters other than tab, newline and carriage return are not allowed in XML 1.0.
        const code = char.codePointAt(0) as number;
        out += code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d ? " " : char;
      }
    }
  }
  return out;
}

/**
 * A PDF literal string, parentheses included. `\`, `(` and `)` are escaped; anything outside
 * printable ASCII is replaced with `?`, because Helvetica is used without an embedded encoding.
 */
export function pdfString(text: string): string {
  let out = "(";
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    if (char === "\\" || char === "(" || char === ")") out += `\\${char}`;
    else if (code < 0x20 || code > 0x7e) out += "?";
    else out += char;
  }
  return `${out})`;
}

/**
 * A number with at most `decimals` decimals (default 3), trailing zeros trimmed, `-0` as `0`, no
 * exponent and no locale. Non-finite values are written as `0`.
 */
export function formatNumber(value: number, decimals = 3): string {
  if (!Number.isFinite(value)) return "0";
  let text = value.toFixed(decimals);
  if (text.includes(".")) text = text.replace(/0+$/, "").replace(/\.$/, "");
  if (text === "-0") return "0";
  return text;
}

/** The UTF-8 encoding of `text`. Lone surrogates are encoded as U+FFFD. */
export function utf8Bytes(text: string): Uint8Array {
  const bytes = new Uint8Array(utf8Length(text));
  let at = 0;
  for (const char of text) {
    let code = char.codePointAt(0) as number;
    if (code >= 0xd800 && code <= 0xdfff) code = 0xfffd;
    if (code < 0x80) {
      bytes[at++] = code;
    } else if (code < 0x800) {
      bytes[at++] = 0xc0 | (code >> 6);
      bytes[at++] = 0x80 | (code & 0x3f);
    } else if (code < 0x10000) {
      bytes[at++] = 0xe0 | (code >> 12);
      bytes[at++] = 0x80 | ((code >> 6) & 0x3f);
      bytes[at++] = 0x80 | (code & 0x3f);
    } else {
      bytes[at++] = 0xf0 | (code >> 18);
      bytes[at++] = 0x80 | ((code >> 12) & 0x3f);
      bytes[at++] = 0x80 | ((code >> 6) & 0x3f);
      bytes[at++] = 0x80 | (code & 0x3f);
    }
  }
  return bytes;
}

/** The number of bytes in the UTF-8 encoding of `text`. */
export function utf8Length(text: string): number {
  let length = 0;
  for (const char of text) {
    const code = char.codePointAt(0) as number;
    if (code < 0x80) length += 1;
    else if (code < 0x800) length += 2;
    else if (code < 0x10000 || (code >= 0xd800 && code <= 0xdfff)) length += 3;
    else length += 4;
  }
  return length;
}
