const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_$]*$/;

export function quoteIdentifier(name: string): string {
  if (IDENTIFIER_RE.test(name)) return name;
  return `"${name.replace(/"/g, '""')}"`;
}

export function fqn(...parts: string[]): string {
  return parts.map(quoteIdentifier).join(".");
}
