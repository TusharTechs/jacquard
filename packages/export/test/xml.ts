// Small XML readers for the SVG tests: a well-formedness check, attribute parsing and unescaping.
// Written for the tests, independent of `src`.

const ENTITY_OK = /&(?!(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)/;

/** Returns undefined when `text` is well-formed XML with one root element, else the first problem. */
export function wellFormedProblem(text: string): string | undefined {
  let s = text;
  if (s.startsWith("<?xml")) {
    const end = s.indexOf("?>");
    if (end < 0) return "unterminated XML declaration";
    s = s.slice(end + 2);
  }
  const stack: string[] = [];
  let roots = 0;
  let i = 0;
  while (i < s.length) {
    const lt = s.indexOf("<", i);
    const chars = lt < 0 ? s.slice(i) : s.slice(i, lt);
    if (ENTITY_OK.test(chars)) return `bare & in text near ${JSON.stringify(chars.slice(0, 40))}`;
    if (stack.length === 0 && chars.trim() !== "") return `text outside the root: ${JSON.stringify(chars.slice(0, 40))}`;
    if (lt < 0) break;
    // Find the end of the tag, skipping quoted attribute values.
    let j = lt + 1;
    let quote: string | undefined;
    while (j < s.length) {
      const c = s[j] as string;
      if (quote !== undefined) {
        if (c === quote) quote = undefined;
        else if (c === "<") return "< inside an attribute value";
      } else if (c === '"' || c === "'") quote = c;
      else if (c === "<") return "< inside a tag";
      else if (c === ">") break;
      j += 1;
    }
    if (j >= s.length) return "unterminated tag";
    const body = s.slice(lt + 1, j);
    i = j + 1;
    if (body.startsWith("/")) {
      const name = body.slice(1).trim();
      const open = stack.pop();
      if (open !== name) return `closing </${name}> does not match <${open ?? "nothing"}>`;
      continue;
    }
    const selfClosing = body.endsWith("/");
    const inner = selfClosing ? body.slice(0, -1) : body;
    const nameMatch = /^([A-Za-z_][\w:.-]*)/.exec(inner);
    if (nameMatch === null) return `bad tag <${body.slice(0, 20)}>`;
    const name = nameMatch[1] as string;
    const rest = inner.slice(name.length);
    const attrPattern = /\s+([A-Za-z_][\w:.-]*)="([^"]*)"/y;
    let at = 0;
    const seen = new Set<string>();
    while (at < rest.length) {
      if (/^\s*$/.test(rest.slice(at))) break;
      attrPattern.lastIndex = at;
      const m = attrPattern.exec(rest);
      if (m === null) return `bad attribute syntax in <${name}${rest.slice(0, 40)}>`;
      const attr = m[1] as string;
      if (seen.has(attr)) return `duplicate attribute ${attr} in <${name}>`;
      seen.add(attr);
      if (ENTITY_OK.test(m[2] as string)) return `bare & in attribute ${attr}`;
      at = attrPattern.lastIndex;
    }
    if (stack.length === 0) roots += 1;
    if (!selfClosing) stack.push(name);
  }
  if (stack.length > 0) return `unclosed <${stack[stack.length - 1] as string}>`;
  if (roots !== 1) return `${roots} root elements`;
  return undefined;
}

/** The attributes of one start tag's attribute text. */
export function attributes(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/([A-Za-z_][\w:.-]*)="([^"]*)"/g)) out[m[1] as string] = m[2] as string;
  return out;
}

/** Every `<name ...>` start tag (self-closing or not) with its attributes, in document order. */
export function startTags(text: string, name: string): Record<string, string>[] {
  const pattern = new RegExp(`<${name}((?:\\s+[A-Za-z_][\\w:.-]*="[^"]*")*)\\s*/?>`, "g");
  return [...text.matchAll(pattern)].map((m) => attributes(m[1] ?? ""));
}

/** Every `<name ...>text</name>` leaf element with its attributes and raw (escaped) text. */
export function leafElements(text: string, name: string): { attrs: Record<string, string>; text: string }[] {
  const pattern = new RegExp(`<${name}((?:\\s+[A-Za-z_][\\w:.-]*="[^"]*")*)\\s*>([^<]*)</${name}>`, "g");
  return [...text.matchAll(pattern)].map((m) => ({ attrs: attributes(m[1] ?? ""), text: m[2] ?? "" }));
}

/** Decodes the five predefined XML entities and numeric character references. */
export function unescapeXml(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);/g, (_, name: string) => {
    switch (name) {
      case "amp":
        return "&";
      case "lt":
        return "<";
      case "gt":
        return ">";
      case "quot":
        return '"';
      case "apos":
        return "'";
      default:
        return String.fromCodePoint(name.startsWith("#x") ? parseInt(name.slice(2), 16) : Number(name.slice(1)));
    }
  });
}
