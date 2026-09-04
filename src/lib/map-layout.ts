// Deterministic pseudo-random field layout — organic-looking paddock shapes
// tiled across a grid, since there's no real GPS boundary data yet. Swap for
// real KML/GeoJSON boundaries per paddock once that's available.
function seededRand(seed: number) {
  const x = Math.sin(seed * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

export type FieldGeo = { points: string; cx: number; cy: number; fontSize: number };

export function buildFieldLayout(count: number): FieldGeo[] {
  const viewW = 900, viewH = 620;
  const cols = Math.max(1, Math.round(Math.sqrt(count * (viewW / viewH))));
  const rows = Math.ceil(count / cols);
  const cellW = viewW / cols;
  const cellH = viewH / rows;
  const pad = 0.09, jitter = 0.14;
  const fontSize = Math.max(6, Math.min(11, cellW / 6.5));
  const layouts: FieldGeo[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % cols, row = Math.floor(i / cols);
    const bx0 = col * cellW + cellW * pad, bx1 = (col + 1) * cellW - cellW * pad;
    const by0 = row * cellH + cellH * pad, by1 = (row + 1) * cellH - cellH * pad;
    const corners: [number, number][] = [[bx0, by0], [bx1, by0], [bx1, by1], [bx0, by1]];
    const jittered = corners.map(([x, y], ci) => [
      x + (seededRand(i * 4 + ci) - 0.5) * cellW * jitter,
      y + (seededRand(i * 4 + ci + 100) - 0.5) * cellH * jitter,
    ]);
    layouts.push({
      points: jittered.map((p) => p.join(",")).join(" "),
      cx: (bx0 + bx1) / 2,
      cy: (by0 + by1) / 2,
      fontSize,
    });
  }
  return layouts;
}
