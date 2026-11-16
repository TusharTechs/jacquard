// Canonical_JSON (11.4, 11.5, 11.7): object keys sorted by UTF-16 code unit at every depth, array
// order kept, no whitespace. Serialisation only, no weaving logic. Members whose value is
// `undefined` are skipped and `undefined` array elements become `null`, as `JSON.stringify` does.

export function canonicalJson(value: unknown): string {
  const text = write(value);
  return text === undefined ? "null" : text;
}

function write(value: unknown): string | undefined {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return JSON.stringify(value);
    case "undefined":
    case "function":
    case "symbol":
      return undefined;
    case "bigint":
      // JSON.stringify throws on bigint; no tool output contains one.
      throw new TypeError("canonicalJson cannot serialise a bigint");
    default:
      break;
  }
  if (Array.isArray(value)) {
    const items = value.map((item) => write(item) ?? "null");
    return `[${items.join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const members: string[] = [];
  for (const key of keys) {
    const text = write(record[key]);
    if (text !== undefined) members.push(`${JSON.stringify(key)}:${text}`);
  }
  return `{${members.join(",")}}`;
}
