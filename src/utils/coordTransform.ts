/**
 * WGS-84 → GCJ-02（火星坐标系）转换
 * 高德地图底图使用 GCJ-02，后端 API 返回的农田坐标为 WGS-84，需在渲染前转换。
 * open-meteo 气象接口使用 WGS-84，无需转换。
 */

function transformLat(lng: number, lat: number): number {
  let ret = -100.0 + 2.0 * lng + 3.0 * lat + 0.2 * lat * lat + 0.1 * lng * lat + 0.2 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lat * Math.PI) + 40.0 * Math.sin(lat / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(lat / 12.0 * Math.PI) + 320.0 * Math.sin(lat * Math.PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(lng: number, lat: number): number {
  let ret = 300.0 + lng + 2.0 * lat + 0.1 * lng * lng + 0.1 * lng * lat + 0.1 * Math.sqrt(Math.abs(lng));
  ret += (20.0 * Math.sin(6.0 * lng * Math.PI) + 20.0 * Math.sin(2.0 * lng * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(lng * Math.PI) + 40.0 * Math.sin(lng / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(lng / 12.0 * Math.PI) + 300.0 * Math.sin(lng / 30.0 * Math.PI)) * 2.0 / 3.0;
  return ret;
}

/**
 * WKT POLYGON → GeoJSON Polygon
 * 输入: "POLYGON((lng lat, lng lat, ...))"  WGS-84坐标系
 * 输出: { type: "Polygon", coordinates: [[[lng, lat], ...]] }
 * FarmMonitor 使用 WGS-84，不做 GCJ-02 偏移。
 */
export function wktToGeoJson(wkt: string): { type: 'Polygon'; coordinates: number[][][] } | null {
  if (!wkt) return null;
  const rings: number[][][] = [];
  const ringRegex = /\(([^)]+)\)/g;
  let match: RegExpExecArray | null;
  while ((match = ringRegex.exec(wkt)) !== null) {
    const points: number[][] = [];
    const pairs = match[1].split(',');
    for (const p of pairs) {
      const parts = p.trim().split(/\s+/);
      if (parts.length >= 2) {
        const lng = Number(parts[0]);
        const lat = Number(parts[1]);
        if (!isNaN(lng) && !isNaN(lat)) points.push([lng, lat]);
      }
    }
    if (points.length === 0) return null;
    const first = points[0], last = points[points.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      points.push([...first]);
    }
    rings.push(points);
  }
  return rings.length > 0 ? { type: 'Polygon', coordinates: rings } : null;
}

export function wgs84ToGcj02(lng: number, lat: number): [number, number] {
  const a = 6378245.0;
  const ee = 0.00669342162296594323;

  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);

  const radLat = (lat / 180.0) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  const sqrtMagic = Math.sqrt(magic);

  dLat = (dLat * 180.0) / (((a * (1 - ee)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180.0) / ((a / sqrtMagic) * Math.cos(radLat) * Math.PI);

  return [lng + dLng, lat + dLat];
}
