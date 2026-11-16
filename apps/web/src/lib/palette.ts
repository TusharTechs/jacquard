// Display colours for design regions. The palette sits next to the design, never inside it.

/** Used when there is no motif palette, or for regions past its end [decision]. */
export const DEFAULT_REGION_COLOURS: readonly string[] = [
  "#f3ead8", // cream ground
  "#8c2f39", // madder red
  "#2f4b7c", // indigo
  "#d9a441", // turmeric
  "#3f6e4a", // leaf green
  "#5a3d6b", // plum
  "#c8693d", // rust
  "#2b2b2b", // charcoal
];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Lower-case `#rrggbb`, or undefined when the text is not a hex colour. */
export function normaliseHex(colour: string): string | undefined {
  if (!HEX.test(colour)) return undefined;
  const digits = colour.slice(1).toLowerCase();
  if (digits.length === 6) return `#${digits}`;
  return `#${digits[0]}${digits[0]}${digits[1]}${digits[1]}${digits[2]}${digits[2]}`;
}

/**
 * One display colour per region. Region i takes motif palette entry i when there is one and it is
 * a hex colour, otherwise the default list (cycled past 8 regions).
 */
export function regionColours(motifPalette: readonly string[] | null | undefined, regionCount: number): string[] {
  const count = Math.max(0, Math.floor(regionCount));
  const colours: string[] = [];
  for (let region = 0; region < count; region += 1) {
    const fromMotif = motifPalette?.[region];
    const normal = fromMotif === undefined ? undefined : normaliseHex(fromMotif);
    colours.push(normal ?? DEFAULT_REGION_COLOURS[region % DEFAULT_REGION_COLOURS.length]!);
  }
  return colours;
}

/** WCAG relative luminance of a `#rrggbb` colour. */
function luminance(hex: string): number {
  const channel = (offset: number): number => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

export const DARK_TEXT = "#1a1a1a";
export const LIGHT_TEXT = "#ffffff";

/** The text colour, near-black or white, with the higher contrast ratio on `hex`. */
export function contrastText(hex: string): string {
  const normal = normaliseHex(hex);
  if (normal === undefined) return DARK_TEXT;
  const background = luminance(normal);
  const dark = luminance(DARK_TEXT);
  const light = luminance(LIGHT_TEXT);
  const againstDark = (background + 0.05) / (dark + 0.05);
  const againstLight = (light + 0.05) / (background + 0.05);
  return againstDark >= againstLight ? DARK_TEXT : LIGHT_TEXT;
}
