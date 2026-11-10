const excerptLength = 240;

function fold(word: string): string {
  return word.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function firstMatch(text: string, terms: Set<string>): number {
  for (const match of text.matchAll(/[\p{L}\p{N}\p{M}]+/gu)) {
    if (terms.has(fold(match[0]))) return match.index;
  }
  return -1;
}

/** Plain-text context around a matched word, with a title-only fallback. */
export function searchExcerpt(
  plainText: string,
  title: string,
  query: string,
): string {
  const body = plainText.replace(/\s+/gu, " ").trim();
  const terms = new Set((query.match(/[\p{L}\p{N}\p{M}]+/gu) ?? []).map(fold));
  const bodyMatch = firstMatch(body, terms);
  const text = bodyMatch >= 0 ? body : title.replace(/\s+/gu, " ").trim();
  const match = bodyMatch >= 0 ? bodyMatch : firstMatch(text, terms);
  const start = Math.max(0, match - 40);
  const end = Math.min(text.length, start + excerptLength);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}
