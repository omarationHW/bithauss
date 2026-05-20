/**
 * Builds progressively less-specific Nominatim queries for an address.
 * Strips Mexican "X Sección" subdivisions (which Nominatim doesn't index)
 * and trims C.P. markers before falling back to neighborhood + city only.
 */
export function buildQueryVariants(raw: string): string[] {
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const variants = new Set<string>();
  variants.add(parts.join(", "));

  // Drop "X Sección" and "C.P. NNNNN" parts
  const cleaned = parts.filter(
    (p) => !/secci[oó]n/i.test(p) && !/^C\.?\s*P\.?\s*\d+$/i.test(p),
  );
  if (cleaned.length && cleaned.join(", ") !== parts.join(", ")) {
    variants.add(cleaned.join(", "));
  }

  // Drop the neighborhood (second part) when we have street + city
  if (cleaned.length >= 3) {
    variants.add([cleaned[0], ...cleaned.slice(2)].join(", "));
  }

  // Street + city + country
  if (cleaned.length >= 3) {
    variants.add(
      [cleaned[0], cleaned[cleaned.length - 2], cleaned[cleaned.length - 1]].join(", "),
    );
  }

  // Neighborhood (stripped of "X Sección") + city + country fallback
  if (parts.length >= 3 && parts[1]) {
    const neigh = parts[1]
      .replace(
        /\s+\b(I|II|III|IV|V|VI|VII|VIII|IX|X|\d+)(ª|ra|da|ta|va)?\s*Secci[oó]n\b/i,
        "",
      )
      .trim();
    if (neigh) {
      variants.add(
        [neigh, parts[parts.length - 2], parts[parts.length - 1]].join(", "),
      );
    }
  }

  return Array.from(variants).filter(Boolean);
}
