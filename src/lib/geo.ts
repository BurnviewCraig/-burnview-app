// Local planar projection + area calc for small (paddock/farm-scale) GeoJSON
// boundaries. Good to well under 0.1% error at these sizes — not meant for
// anything continental.

export type LonLat = [number, number];
export type Ring = LonLat[];
export type BoundaryGeometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

const DEG2RAD = Math.PI / 180;
const METERS_PER_DEG_LAT = 110574;

function metersPerDegLon(latDeg: number) {
  return 111320 * Math.cos(latDeg * DEG2RAD);
}

// Project lon/lat to flat meters around an origin, with y flipped so that
// increasing latitude (north) maps to decreasing SVG y (up).
export function ringToPlaneMeters(ring: Ring, originLon: number, originLat: number): [number, number][] {
  const mPerLon = metersPerDegLon(originLat);
  return ring.map(([lon, lat]) => [(lon - originLon) * mPerLon, -(lat - originLat) * METERS_PER_DEG_LAT]);
}

function shoelaceArea(points: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

function polygonRingsToPolygons(geom: BoundaryGeometry): Ring[][] {
  return geom.type === "Polygon" ? [geom.coordinates] : geom.coordinates;
}

export function geometryCentroidLonLat(geom: BoundaryGeometry): LonLat {
  let sx = 0, sy = 0, n = 0;
  for (const polygon of polygonRingsToPolygons(geom)) {
    const outer = polygon[0] ?? [];
    for (const [lon, lat] of outer) { sx += lon; sy += lat; n++; }
  }
  return n ? [sx / n, sy / n] : [0, 0];
}

export function boundaryAreaHectares(geom: BoundaryGeometry): number {
  const [lon0, lat0] = geometryCentroidLonLat(geom);
  let totalM2 = 0;
  for (const polygon of polygonRingsToPolygons(geom)) {
    if (!polygon.length) continue;
    const outer = shoelaceArea(ringToPlaneMeters(polygon[0], lon0, lat0));
    const holes = polygon.slice(1).reduce((s, ring) => s + shoelaceArea(ringToPlaneMeters(ring, lon0, lat0)), 0);
    totalM2 += Math.max(0, outer - holes);
  }
  return totalM2 / 10000;
}

// Projects several paddocks' boundaries into one shared local coordinate
// system (meters, origin at their combined centroid) so they can be drawn
// together on one map.
export function projectBoundariesShared<T extends { boundary: BoundaryGeometry }>(
  items: T[]
): (T & { rings: [number, number][][] })[] {
  let sx = 0, sy = 0, n = 0;
  for (const it of items) {
    const [lon, lat] = geometryCentroidLonLat(it.boundary);
    sx += lon; sy += lat; n++;
  }
  const lon0 = n ? sx / n : 0;
  const lat0 = n ? sy / n : 0;
  return items.map((it) => ({
    ...it,
    rings: polygonRingsToPolygons(it.boundary).map((polygon) => ringToPlaneMeters(polygon[0] ?? [], lon0, lat0)),
  }));
}

// Fits a set of point rings into an SVG viewBox, preserving aspect ratio.
export function fitRingsToViewBox(
  ringSets: [number, number][][][],
  viewW: number,
  viewH: number,
  pad: number
): [number, number][][][] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const rings of ringSets) for (const ring of rings) for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const innerW = viewW - 2 * pad;
  const innerH = viewH - 2 * pad;
  const scale = Math.min(innerW / spanX, innerH / spanY);
  const offsetX = pad + (innerW - spanX * scale) / 2 - minX * scale;
  const offsetY = pad + (innerH - spanY * scale) / 2 - minY * scale;
  return ringSets.map((rings) => rings.map((ring) => ring.map(([x, y]) => [x * scale + offsetX, y * scale + offsetY])));
}
