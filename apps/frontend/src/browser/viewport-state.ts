export interface ScrollPosition {
  x: number;
  y: number;
}

export function isScrollPosition(value: unknown): value is ScrollPosition {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const position = value as Record<string, unknown>;
  return (
    Object.keys(position).sort().join(",") === "x,y" &&
    [position.x, position.y].every(
      (coordinate) =>
        typeof coordinate === "number" &&
        Number.isFinite(coordinate) &&
        coordinate >= 0 &&
        coordinate <= 100_000_000,
    )
  );
}
