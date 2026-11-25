/** Una persona por línea; sin vacíos, espacios sobrantes ni repetidos. */
export function parseRepresentatives(text: string): string[] {
  const names = text.split("\n").map((n) => n.trim().replace(/\s+/g, " ")).filter(Boolean);
  return [...new Set(names)];
}
